/**
 * POST /api/ai/resume-tailor-v2
 *
 * Body: { match_id: string }
 *
 * The orchestrator for the v2 pipeline. Wraps the four passes
 * (cluster classify → reuse-check → story brief → atom selection → composition)
 * and persists the result into tailored_resumes so the existing PDF route
 * can render it without changes.
 *
 * Composes by stitching the v2 bullets back into the user's structured_resume
 * shape: per role, replace the original `bullets[]` with composed ones, keep
 * untouched roles intact, keep summary/skills/projects/education as-is.
 *
 * Returns:
 *   {
 *     tailored_resume_id,
 *     reused: bool,                    // true → no fresh composition; pulled from prior tailoring
 *     reuse_reason?: string,
 *     brief: { id, positioning, key_themes, caliber_signals },
 *     cluster: { cluster_id, seniority_band, cluster_confidence },
 *     bullets_by_role: [{ company, role, bullets: [{text, cited_atom_ids, validation, source_atom_facts}] }],
 *     selection_dropped: [{ id, fact, reason }],
 *     stats: { atoms_total, atoms_selected, atoms_dropped, bullets_total, bullets_failed, bullets_over_budget },
 *     tokens: { ... },
 *   }
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ensureJobCluster } from '@/lib/ai/ensure-job-cluster';
import { ensureJdCluster } from '@/lib/ai/ensure-jd-cluster';
import { buildResumeStoryBriefPrompt } from '@/lib/ai/prompts/resume-story-brief';
import { buildResumeSelectAtomsPrompt } from '@/lib/ai/prompts/resume-select-atoms';
import { buildResumeComposePrompt } from '@/lib/ai/prompts/resume-compose';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const REUSE_TTL_DAYS = 14;

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
      throw new Error('AI output unparseable');
    }
    return JSON.parse(stripped.slice(first, last + 1));
  }
}

// Same numeric token / coverage helpers as in resume-compose route — kept inline
// here so the orchestrator can re-validate on its own composed payload without
// importing across route boundaries.
const KNOWN_UNITS = '(?:%|x|X|k|K|m|M|b|B|cr|lakh|crore|crores|hr|hrs|day|days|wk|weeks|mo|months|yr|yrs)';
const NUM_RE = new RegExp(`([\\₹\\$€£]?\\d+(?:[\\.,]\\d+)?\\+?${KNOWN_UNITS}?)`, 'g');

function extractNumericTokens(text) {
  const tokens = new Set();
  for (const match of text.matchAll(NUM_RE)) {
    const tok = (match[1] || '').trim();
    if (!tok || !/\d/.test(tok)) continue;
    if (/^\d{4}$/.test(tok) && parseInt(tok, 10) >= 1990 && parseInt(tok, 10) <= 2100) continue;
    tokens.add(tok.toLowerCase());
    const noComma = tok.toLowerCase().replace(/,/g, '');
    if (noComma !== tok.toLowerCase()) tokens.add(noComma);
  }
  return [...tokens];
}

function isTokenCovered(token, atom) {
  const t = token.toLowerCase().replace(/\s/g, '');
  const fact = (atom.fact || '').toLowerCase().replace(/\s/g, '');
  if (fact.includes(t)) return true;
  const numericCore = t.replace(/[₹\$€£,+]/g, '').replace(/[a-z%]+$/i, '');
  if (atom.metric && atom.metric.value !== undefined) {
    const metricStr = String(atom.metric.value).toLowerCase();
    if (numericCore === metricStr) return true;
    if (numericCore && metricStr && (numericCore.includes(metricStr) || metricStr.includes(numericCore))) return true;
  }
  if (numericCore && fact.replace(/,/g, '').includes(numericCore)) return true;
  return false;
}

function validateBullet(bullet, atomsById) {
  const issues = [];
  const cited = (bullet.cited_atom_ids || []).map((id) => atomsById.get(id));
  if (cited.some((a) => !a)) issues.push('phantom_citation');
  if (!cited.length) issues.push('no_citations');
  if (issues.length) return { ok: false, issues };

  const numbers = extractNumericTokens(bullet.text);
  for (const n of numbers) {
    if (!cited.some((a) => isTokenCovered(n, a))) issues.push(`unsourced_number:${n}`);
  }
  const wordCount = bullet.text.trim().split(/\s+/).length;
  return {
    ok: issues.length === 0,
    issues,
    word_count: wordCount,
    over_budget: wordCount > 22,
  };
}

// Build the per-role atom summary (no facts, only counts + tags) used by the brief prompt.
function buildAtomSummary(atoms) {
  const byRole = new Map();
  for (const a of atoms) {
    const k = `${a.company || '—'}::${a.role || '—'}`;
    if (!byRole.has(k)) {
      byRole.set(k, {
        company: a.company,
        role: a.role,
        start_date: a.start_date,
        end_date: a.end_date,
        atom_count: 0,
        tag_counts: {},
      });
    }
    const e = byRole.get(k);
    e.atom_count++;
    for (const t of a.tags || []) e.tag_counts[t] = (e.tag_counts[t] || 0) + 1;
  }
  return [...byRole.values()]
    .sort((a, b) => (b.end_date || '9999').localeCompare(a.end_date || '9999'))
    .map((r) => ({
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

// Stitch composed bullets back into the structured_resume shape.
// Strategy: walk the original experience entries; if the role matches a
// composed group (by company+role string match), replace its bullets with the
// composed ones. Untouched entries keep their bullets. Bullet IDs are minted
// fresh from a global counter to avoid collisions with existing IDs.
function stitchTailoredResume(baseResume, bulletsByRole) {
  const version = JSON.parse(JSON.stringify(baseResume));

  // Compute global bullet-id watermark across whole resume so we don't collide.
  let maxId = 0;
  for (const sec of ['experience', 'projects']) {
    for (const e of version[sec] || []) {
      for (const b of e.bullets || []) {
        const num = parseInt(String(b.id || '').replace(/\D/g, ''), 10);
        if (Number.isFinite(num) && num > maxId) maxId = num;
      }
    }
  }
  const mintId = () => {
    maxId++;
    return `b_${String(maxId).padStart(3, '0')}`;
  };

  const norm = (s) => (s || '').toLowerCase().trim();
  const matchedRoles = new Set();

  for (const group of bulletsByRole) {
    const idx = (version.experience || []).findIndex(
      (e) => norm(e.company) === norm(group.company) && norm(e.title) === norm(group.role),
    );
    if (idx === -1) continue;
    matchedRoles.add(idx);
    const entry = version.experience[idx];
    entry.bullets = group.bullets.map((b) => ({
      id: mintId(),
      text: b.text,
      tags: [],
      cited_atom_ids: b.cited_atom_ids || [],
    }));
  }

  return { version, matched_indexes: [...matchedRoles] };
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { match_id, jd_id } = body;

    if (!match_id && !jd_id) {
      return NextResponse.json({ error: 'match_id or jd_id required' }, { status: 400 });
    }

    // ── 1. Resolve job source → cluster ─────────────────────────────
    // Two paths: CareerPilot (match_id → job_matches → jobs)
    //            RolePitch   (jd_id   → job_descriptions)
    let job;
    let cluster;
    const anchorId = jd_id || match_id; // used as the FK in tailored_resumes

    if (jd_id) {
      const { data: jd } = await supabase
        .from('job_descriptions')
        .select('id, title, company, description, cluster_id, seniority_band, cluster_confidence')
        .eq('id', jd_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!jd) {
        return NextResponse.json({ error: 'Job description not found' }, { status: 404 });
      }
      job = { id: jd.id, title: jd.title, company: jd.company, description: jd.description };
      cluster = await ensureJdCluster(supabase, jd.id);
    } else {
      const { data: match } = await supabase
        .from('job_matches')
        .select('id, jobs ( id, title, company, description, cluster_id, seniority_band, cluster_confidence )')
        .eq('id', match_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!match?.jobs) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      }
      job = match.jobs;
      cluster = await ensureJobCluster(supabase, job.id);
    }

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster classification failed' }, { status: 500 });
    }

    // ── 2. Load profile (for kb version + structured_resume base) ───
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, structured_resume, knowledge_base_version, parsed_at')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profile?.structured_resume) {
      return NextResponse.json(
        { error: 'No structured resume on file. Upload your resume first.' },
        { status: 400 },
      );
    }
    const kbv = profile.knowledge_base_version || 1;

    // ── 3. Reuse check ──────────────────────────────────────────────
    // pm-other clusters never reuse (too noisy a bucket).
    let reuseRow = null;
    if (cluster.cluster_id !== 'pm-other') {
      const { data: prior } = await supabase
        .from('tailored_resumes')
        .select(
          'id, story_brief_id, selected_atom_ids, tailored_version, updated_at, ' +
            'resume_story_briefs!inner(id, cluster_id, seniority_band, knowledge_base_version, positioning, key_themes, caliber_signals)',
        )
        .eq('user_id', user.id)
        .eq('resume_story_briefs.cluster_id', cluster.cluster_id)
        .eq('resume_story_briefs.seniority_band', cluster.seniority_band)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prior) {
        const ageDays = (Date.now() - new Date(prior.updated_at).getTime()) / 86_400_000;
        const briefKbv = prior.resume_story_briefs?.knowledge_base_version || 0;
        if (ageDays <= REUSE_TTL_DAYS && briefKbv >= kbv) {
          reuseRow = prior;
        }
      }
    }

    if (reuseRow) {
      // Find or create a tailored_resumes row for THIS match, reusing the prior version.
      const trQuery = supabase
        .from('tailored_resumes')
        .select('id')
        .eq('user_id', user.id);
      if (jd_id) trQuery.eq('jd_id', jd_id); else trQuery.eq('match_id', match_id);
      const { data: existing } = await trQuery.maybeSingle();

      let tailoredId = existing?.id;
      if (!tailoredId) {
        const { data: created } = await supabase
          .from('tailored_resumes')
          .insert({
            user_id: user.id,
            ...(jd_id ? { jd_id } : { match_id }),
            base_version: profile.structured_resume,
            tailored_version: reuseRow.tailored_version,
            story_brief_id: reuseRow.story_brief_id,
            selected_atom_ids: reuseRow.selected_atom_ids,
            reused_from: reuseRow.id,
            pipeline_version: 'v2',
          })
          .select('id')
          .single();
        tailoredId = created?.id;
      } else {
        // Update existing row to point at reused content
        await supabase
          .from('tailored_resumes')
          .update({
            tailored_version: reuseRow.tailored_version,
            story_brief_id: reuseRow.story_brief_id,
            selected_atom_ids: reuseRow.selected_atom_ids,
            reused_from: reuseRow.id,
            pipeline_version: 'v2',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tailoredId);
      }

      const reusedBullets = (reuseRow.tailored_version?.experience || []).map((e) => ({
        company: e.company,
        role: e.title,
        bullets: (e.bullets || []).map((b) => ({
          text: b.text,
          cited_atom_ids: b.cited_atom_ids || [],
          validation: { ok: true, issues: [], reused: true },
        })),
      }));

      return NextResponse.json({
        tailored_resume_id: tailoredId,
        reused: true,
        reuse_reason: 'cluster_match_within_ttl',
        cluster,
        brief: reuseRow.resume_story_briefs,
        bullets_by_role: reusedBullets,
        selection_dropped: [],
        stats: {
          atoms_total: 0,
          atoms_selected: (reuseRow.selected_atom_ids || []).length,
          atoms_dropped: 0,
          bullets_total: reusedBullets.reduce((s, r) => s + r.bullets.length, 0),
          bullets_failed: 0,
          bullets_over_budget: 0,
        },
        tokens: { input_tokens: 0, output_tokens: 0 },
      });
    }

    // ── 4. Story brief (cache or fresh) ────────────────────────────
    let brief;
    let briefTokens = { input_tokens: 0, output_tokens: 0 };
    {
      const { data: cached } = await supabase
        .from('resume_story_briefs')
        .select('id, positioning, key_themes, caliber_signals, knowledge_base_version')
        .eq('user_id', user.id)
        .eq('cluster_id', cluster.cluster_id)
        .eq('seniority_band', cluster.seniority_band)
        .maybeSingle();

      if (cached && (cached.knowledge_base_version || 0) >= kbv) {
        brief = cached;
      } else {
        const { data: atomsForBrief } = await supabase
          .from('user_experience_memory')
          .select('company, role, start_date, end_date, tags')
          .eq('user_id', user.id)
          .gte('confidence', 0.6);

        if (!atomsForBrief?.length) {
          return NextResponse.json(
            { error: 'No atoms available — re-upload resume to atomize.' },
            { status: 400 },
          );
        }

        const atomSummary = buildAtomSummary(atomsForBrief);
        const { system, user: userPrompt } = buildResumeStoryBriefPrompt({
          job: { ...job, ...cluster },
          atomSummary,
        });

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          temperature: 0.3,
          system,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const parsed = tolerantParse(msg.content[0].text);
        briefTokens = msg.usage;

        const { data: upserted } = await supabase
          .from('resume_story_briefs')
          .upsert(
            {
              user_id: user.id,
              cluster_id: cluster.cluster_id,
              seniority_band: cluster.seniority_band,
              positioning: parsed.positioning,
              key_themes: parsed.key_themes,
              caliber_signals: parsed.caliber_signals,
              knowledge_base_version: kbv,
              source_match_ids: match_id ? [match_id] : [],
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,cluster_id,seniority_band' },
          )
          .select('id, positioning, key_themes, caliber_signals')
          .single();
        brief = upserted;
      }
    }

    // ── 5. Atom selection ──────────────────────────────────────────
    const { data: allAtoms } = await supabase
      .from('user_experience_memory')
      .select('id, nugget_type, company, role, start_date, end_date, fact, metric, tags, confidence')
      .eq('user_id', user.id)
      .gte('confidence', 0.6);

    if (!allAtoms?.length) {
      return NextResponse.json(
        { error: 'No atoms available — re-upload resume to atomize.' },
        { status: 400 },
      );
    }

    const validIds = new Set(allAtoms.map((a) => a.id));
    const atomsById = new Map(allAtoms.map((a) => [a.id, a]));

    const { system: selSys, user: selUser } = buildResumeSelectAtomsPrompt({
      brief,
      cluster,
      atoms: allAtoms,
    });
    const selMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      temperature: 0.2,
      system: selSys,
      messages: [{ role: 'user', content: selUser }],
    });
    const selParsed = tolerantParse(selMsg.content[0].text);

    const cleanedSelections = (selParsed.selections || []).map((s) => ({
      company: s.company,
      role: s.role,
      atom_ids: (s.atom_ids || []).filter((id) => validIds.has(id)),
    }));
    const cleanedDropped = (selParsed.dropped_atoms || [])
      .filter((d) => validIds.has(d.id))
      .map((d) => {
        const a = atomsById.get(d.id);
        return { id: d.id, fact: a?.fact, reason: d.reason };
      });

    const totalSelected = cleanedSelections.reduce((s, r) => s + r.atom_ids.length, 0);

    // ── 6. Composition ──────────────────────────────────────────────
    const roleGroups = cleanedSelections
      .map((sel) => ({
        company: sel.company,
        role: sel.role,
        atoms: sel.atom_ids
          .map((id) => atomsById.get(id))
          .filter(Boolean)
          .map((a) => ({
            id: a.id,
            type: a.nugget_type,
            fact: a.fact,
            metric: a.metric,
            tags: a.tags,
            start_date: a.start_date,
            end_date: a.end_date,
          })),
      }))
      .filter((g) => g.atoms.length > 0);

    if (!roleGroups.length) {
      return NextResponse.json({ error: 'Selection produced no role groups to compose' }, { status: 500 });
    }

    const { system: compSys, user: compUser } = buildResumeComposePrompt({ brief, roleGroups });
    const compMsg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      temperature: 0.4,
      system: compSys,
      messages: [{ role: 'user', content: compUser }],
    });
    const compParsed = tolerantParse(compMsg.content[0].text);
    if (!Array.isArray(compParsed.bullets)) {
      return NextResponse.json({ error: 'Composition output malformed' }, { status: 500 });
    }

    // Group composed bullets by role + run validation
    const groupKey = (c, r) => `${(c || '').toLowerCase()}::${(r || '').toLowerCase()}`;
    const grouped = new Map();
    for (const g of roleGroups) grouped.set(groupKey(g.company, g.role), { company: g.company, role: g.role, bullets: [] });

    let bulletsFailed = 0;
    let bulletsOverBudget = 0;
    for (const b of compParsed.bullets) {
      const v = validateBullet(b, atomsById);
      if (!v.ok) bulletsFailed++;
      if (v.over_budget) bulletsOverBudget++;
      const key = groupKey(b.company, b.role);
      const slot = grouped.get(key);
      if (!slot) continue;
      slot.bullets.push({
        text: b.text,
        cited_atom_ids: b.cited_atom_ids || [],
        validation: v,
        source_atom_facts: (b.cited_atom_ids || [])
          .map((id) => atomsById.get(id)?.fact)
          .filter(Boolean),
      });
    }
    const bulletsByRole = [...grouped.values()].filter((g) => g.bullets.length > 0);

    // ── 7. Stitch + persist ────────────────────────────────────────
    const { version: stitched } = stitchTailoredResume(profile.structured_resume, bulletsByRole);

    const allSelectedAtomIds = cleanedSelections.flatMap((s) => s.atom_ids);

    const freshQuery = supabase
      .from('tailored_resumes')
      .select('id')
      .eq('user_id', user.id);
    if (jd_id) freshQuery.eq('jd_id', jd_id); else freshQuery.eq('match_id', match_id);
    const { data: existing } = await freshQuery.maybeSingle();

    let tailoredId = existing?.id;
    if (!tailoredId) {
      const { data: created } = await supabase
        .from('tailored_resumes')
        .insert({
          user_id: user.id,
          ...(jd_id ? { jd_id } : { match_id }),
          base_version: profile.structured_resume,
          tailored_version: stitched,
          story_brief_id: brief.id,
          selected_atom_ids: allSelectedAtomIds,
          pipeline_version: 'v2',
        })
        .select('id')
        .single();
      tailoredId = created?.id;
    } else {
      await supabase
        .from('tailored_resumes')
        .update({
          tailored_version: stitched,
          story_brief_id: brief.id,
          selected_atom_ids: allSelectedAtomIds,
          pipeline_version: 'v2',
          reused_from: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tailoredId);
    }

    // Bump use_count on selected atoms (best-effort, non-blocking)
    if (allSelectedAtomIds.length) {
      supabase
        .from('user_experience_memory')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', allSelectedAtomIds)
        .then(({ error }) => {
          if (error) console.warn('[resume-tailor-v2] use_count bump failed:', error.message);
        });
    }

    return NextResponse.json({
      tailored_resume_id: tailoredId,
      reused: false,
      cluster,
      brief,
      bullets_by_role: bulletsByRole,
      selection_dropped: cleanedDropped,
      stats: {
        atoms_total: allAtoms.length,
        atoms_selected: totalSelected,
        atoms_dropped: cleanedDropped.length,
        bullets_total: compParsed.bullets.length,
        bullets_failed: bulletsFailed,
        bullets_over_budget: bulletsOverBudget,
      },
      tokens: {
        brief: briefTokens,
        select: selMsg.usage,
        compose: compMsg.usage,
      },
    });
  } catch (err) {
    console.error('[resume-tailor-v2]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
