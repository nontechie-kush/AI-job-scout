/**
 * POST /api/ai/resume-story-brief
 *
 * Body: { match_id: string, force?: boolean }
 *
 * Pass 1 of the v2 pipeline. Produces a positioning + key_themes + caliber_signals
 * brief for this role-cluster, cached per (user, cluster_id, seniority_band).
 *
 * Cache hit returns immediately (no model call). Cache invalidates when
 * profiles.knowledge_base_version is newer than the cached brief's version.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md (Pass 1)
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ensureJobCluster } from '@/lib/ai/ensure-job-cluster';
import { buildResumeStoryBriefPrompt } from '@/lib/ai/prompts/resume-story-brief';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(rawText) {
  const stripped = rawText
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('Story brief output unparseable');
    }
    return JSON.parse(stripped.slice(first, last + 1));
  }
}

/**
 * Build the per-role atom summary that the brief prompt sees.
 * Deliberately strips fact text — brief writes positioning, not bullets.
 */
function buildAtomSummary(atoms) {
  const byRole = new Map();
  for (const a of atoms) {
    const key = `${a.company || '—'}::${a.role || '—'}`;
    if (!byRole.has(key)) {
      byRole.set(key, {
        company: a.company,
        role: a.role,
        start_date: a.start_date,
        end_date: a.end_date,
        atom_count: 0,
        tag_counts: {},
      });
    }
    const e = byRole.get(key);
    e.atom_count++;
    for (const t of a.tags || []) {
      e.tag_counts[t] = (e.tag_counts[t] || 0) + 1;
    }
  }
  // Sort roles by recency (end_date descending; nulls = 'present' = newest)
  const roles = [...byRole.values()].sort((a, b) => {
    const ae = a.end_date || '9999-99-99';
    const be = b.end_date || '9999-99-99';
    return be.localeCompare(ae);
  });
  // Reduce tag map → top 5 per role
  return roles.map((r) => ({
    company: r.company,
    role: r.role,
    start_date: r.start_date,
    end_date: r.end_date,
    atom_count: r.atom_count,
    top_tags: Object.entries(r.tag_counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t),
  }));
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, force = false } = await request.json();
    if (!match_id) {
      return NextResponse.json({ error: 'match_id required' }, { status: 400 });
    }

    // Resolve match → job
    const { data: match } = await supabase
      .from('job_matches')
      .select('id, jobs ( id, title, company, description )')
      .eq('id', match_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!match?.jobs) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const job = match.jobs;
    const cluster = await ensureJobCluster(supabase, job.id);
    if (!cluster) {
      return NextResponse.json({ error: 'Cluster classification failed' }, { status: 500 });
    }

    // Current KB version (atoms may have grown since last brief)
    const { data: profile } = await supabase
      .from('profiles')
      .select('knowledge_base_version')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const currentKbVersion = profile?.knowledge_base_version || 1;

    // Cache lookup
    if (!force) {
      const { data: cached } = await supabase
        .from('resume_story_briefs')
        .select('id, positioning, key_themes, caliber_signals, knowledge_base_version, source_match_ids, updated_at')
        .eq('user_id', user.id)
        .eq('cluster_id', cluster.cluster_id)
        .eq('seniority_band', cluster.seniority_band)
        .maybeSingle();

      if (cached && cached.knowledge_base_version >= currentKbVersion) {
        // Append this match to source_match_ids for audit (best-effort, non-blocking)
        const merged = Array.from(new Set([...(cached.source_match_ids || []), match_id]));
        if (merged.length !== (cached.source_match_ids || []).length) {
          await supabase
            .from('resume_story_briefs')
            .update({ source_match_ids: merged, updated_at: new Date().toISOString() })
            .eq('id', cached.id);
        }
        return NextResponse.json({
          brief_id: cached.id,
          cached: true,
          cluster,
          positioning: cached.positioning,
          key_themes: cached.key_themes,
          caliber_signals: cached.caliber_signals,
        });
      }
    }

    // Cache miss → load atoms and build summary for the prompt
    const { data: atoms } = await supabase
      .from('user_experience_memory')
      .select('company, role, start_date, end_date, tags, confidence')
      .eq('user_id', user.id)
      .gte('confidence', 0.6);

    if (!atoms?.length) {
      return NextResponse.json(
        { error: 'No atoms found. Atomize the resume first.' },
        { status: 400 },
      );
    }

    const atomSummary = buildAtomSummary(atoms);

    const { system, user: userPrompt } = buildResumeStoryBriefPrompt({
      job: { ...job, cluster_id: cluster.cluster_id, seniority_band: cluster.seniority_band },
      atomSummary,
    });

    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const parsed = tolerantParse(aiMessage.content[0].text.trim());
    if (!parsed.positioning || !Array.isArray(parsed.key_themes) || !Array.isArray(parsed.caliber_signals)) {
      console.error('[resume-story-brief] malformed brief', parsed);
      return NextResponse.json({ error: 'Brief output malformed' }, { status: 500 });
    }

    // Upsert into cache (unique on user_id + cluster_id + seniority_band)
    const { data: upserted, error: upsertErr } = await supabase
      .from('resume_story_briefs')
      .upsert(
        {
          user_id: user.id,
          cluster_id: cluster.cluster_id,
          seniority_band: cluster.seniority_band,
          positioning: parsed.positioning,
          key_themes: parsed.key_themes,
          caliber_signals: parsed.caliber_signals,
          knowledge_base_version: currentKbVersion,
          source_match_ids: [match_id],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,cluster_id,seniority_band' },
      )
      .select('id')
      .single();

    if (upsertErr) {
      console.error('[resume-story-brief] upsert failed', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      brief_id: upserted.id,
      cached: false,
      cluster,
      positioning: parsed.positioning,
      key_themes: parsed.key_themes,
      caliber_signals: parsed.caliber_signals,
      tokens: aiMessage.usage,
    });
  } catch (err) {
    console.error('[resume-story-brief]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
