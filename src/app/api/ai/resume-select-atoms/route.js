/**
 * POST /api/ai/resume-select-atoms
 *
 * Body: { match_id: string, brief_id?: string }
 *
 * Pass 2 of the v2 pipeline. Picks 4-6 atoms per role from the user's
 * inventory based on the story brief. Returns ordered atom_ids per role
 * plus dropped_atoms with reasons (for the audit UI).
 *
 * If brief_id not supplied, looks up the cached brief for this match's cluster.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md (Pass 2)
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ensureJobCluster } from '@/lib/ai/ensure-job-cluster';
import { buildResumeSelectAtomsPrompt } from '@/lib/ai/prompts/resume-select-atoms';

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
      throw new Error('Selection output unparseable');
    }
    return JSON.parse(stripped.slice(first, last + 1));
  }
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, brief_id } = await request.json();
    if (!match_id) {
      return NextResponse.json({ error: 'match_id required' }, { status: 400 });
    }

    // Resolve match → job → cluster
    const { data: match } = await supabase
      .from('job_matches')
      .select('id, jobs ( id, title, company, description )')
      .eq('id', match_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!match?.jobs) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const cluster = await ensureJobCluster(supabase, match.jobs.id);
    if (!cluster) {
      return NextResponse.json({ error: 'Cluster classification failed' }, { status: 500 });
    }

    // Load story brief (by id if given, else by cluster lookup)
    let brief;
    if (brief_id) {
      const { data } = await supabase
        .from('resume_story_briefs')
        .select('id, positioning, key_themes, caliber_signals')
        .eq('id', brief_id)
        .eq('user_id', user.id)
        .maybeSingle();
      brief = data;
    } else {
      const { data } = await supabase
        .from('resume_story_briefs')
        .select('id, positioning, key_themes, caliber_signals')
        .eq('user_id', user.id)
        .eq('cluster_id', cluster.cluster_id)
        .eq('seniority_band', cluster.seniority_band)
        .maybeSingle();
      brief = data;
    }

    if (!brief) {
      return NextResponse.json(
        { error: 'No story brief for this cluster. Run /api/ai/resume-story-brief first.' },
        { status: 400 },
      );
    }

    // Load atoms (with full fact text for selection)
    const { data: atoms } = await supabase
      .from('user_experience_memory')
      .select('id, nugget_type, company, role, start_date, end_date, fact, metric, tags, confidence')
      .eq('user_id', user.id)
      .gte('confidence', 0.6);

    if (!atoms?.length) {
      return NextResponse.json({ error: 'No atoms available' }, { status: 400 });
    }

    const validIds = new Set(atoms.map((a) => a.id));

    const { system, user: userPrompt } = buildResumeSelectAtomsPrompt({
      brief,
      cluster,
      atoms,
    });

    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (aiMessage.stop_reason === 'max_tokens') {
      console.warn('[resume-select-atoms] hit max_tokens — selection likely truncated');
    }

    const parsed = tolerantParse(aiMessage.content[0].text.trim());

    if (!Array.isArray(parsed.selections)) {
      console.error('[resume-select-atoms] missing selections', parsed);
      return NextResponse.json({ error: 'Selection output malformed' }, { status: 500 });
    }

    // Sanitize: filter out phantom atom_ids the model might have hallucinated
    const cleanedSelections = parsed.selections.map((sel) => ({
      company: sel.company,
      role: sel.role,
      atom_ids: (sel.atom_ids || []).filter((id) => validIds.has(id)),
    }));

    const cleanedDropped = (parsed.dropped_atoms || []).filter((d) => validIds.has(d.id));

    // Audit: which atoms were referenced (selected or dropped)
    const referencedIds = new Set([
      ...cleanedSelections.flatMap((s) => s.atom_ids),
      ...cleanedDropped.map((d) => d.id),
    ]);
    const orphanCount = atoms.filter((a) => !referencedIds.has(a.id)).length;
    if (orphanCount > 0) {
      console.warn(`[resume-select-atoms] ${orphanCount} atoms missing from selection/drop lists`);
    }

    const totalSelected = cleanedSelections.reduce((sum, s) => sum + s.atom_ids.length, 0);

    return NextResponse.json({
      brief_id: brief.id,
      cluster,
      selections: cleanedSelections,
      dropped_atoms: cleanedDropped,
      stats: {
        total_atoms: atoms.length,
        selected: totalSelected,
        dropped: cleanedDropped.length,
        orphans: orphanCount,
      },
      tokens: aiMessage.usage,
    });
  } catch (err) {
    console.error('[resume-select-atoms]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
