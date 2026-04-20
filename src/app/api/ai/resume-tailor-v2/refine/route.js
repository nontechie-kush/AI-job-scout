/**
 * POST /api/ai/resume-tailor-v2/refine
 *
 * Called after the user answers targeted gap questions.
 * Atomizes answers into user_experience_memory, then re-runs
 * selection + composition and updates the tailored_resumes row.
 *
 * Body: {
 *   match_id: string,
 *   tailored_resume_id: string,
 *   answers: [{ question: string, answer: string, role_hint?: string }]
 * }
 *
 * Returns same shape as /api/ai/resume-tailor-v2:
 *   { bullets_by_role, stats, tokens, tailored_resume_id }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildResumeSelectAtomsPrompt } from '@/lib/ai/prompts/resume-select-atoms';
import { buildResumeComposePrompt } from '@/lib/ai/prompts/resume-compose';
import { ensureJdCluster } from '@/lib/ai/ensure-jd-cluster';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(rawText) {
  const stripped = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim();
  try { return JSON.parse(stripped); } catch {
    const f = stripped.indexOf('{'); const l = stripped.lastIndexOf('}');
    if (f === -1 || l <= f) throw new Error('AI output unparseable');
    return JSON.parse(stripped.slice(f, l + 1));
  }
}

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
  return { ok: issues.length === 0, issues, word_count: wordCount, over_budget: wordCount > 22 };
}

function stitchTailoredResume(baseResume, bulletsByRole) {
  const version = JSON.parse(JSON.stringify(baseResume));
  let maxId = 0;
  for (const sec of ['experience', 'projects']) {
    for (const e of version[sec] || []) {
      for (const b of e.bullets || []) {
        const num = parseInt(String(b.id || '').replace(/\D/g, ''), 10);
        if (Number.isFinite(num) && num > maxId) maxId = num;
      }
    }
  }
  const mintId = () => { maxId++; return `b_${String(maxId).padStart(3, '0')}`; };
  const norm = (s) => (s || '').toLowerCase().trim();
  for (const group of bulletsByRole) {
    const idx = (version.experience || []).findIndex(
      (e) => norm(e.company) === norm(group.company) && norm(e.title) === norm(group.role),
    );
    if (idx === -1) continue;
    version.experience[idx].bullets = group.bullets.map((b) => ({
      id: mintId(), text: b.text, tags: [], cited_atom_ids: b.cited_atom_ids || [],
    }));
  }
  return version;
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, jd_id, tailored_resume_id, answers } = await request.json();
    if ((!match_id && !jd_id) || !tailored_resume_id || !Array.isArray(answers) || !answers.length) {
      return NextResponse.json({ error: 'match_id or jd_id, tailored_resume_id, answers required' }, { status: 400 });
    }

    // ── 1. Load context ─────────────────────────────────────────────
    const [{ data: tailoredRow }, { data: profile }, { data: briefRow }] = await Promise.all([
      supabase.from('tailored_resumes')
        .select('base_version, story_brief_id')
        .eq('id', tailored_resume_id).eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles')
        .select('knowledge_base_version')
        .eq('user_id', user.id).order('parsed_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('tailored_resumes')
        .select('resume_story_briefs(id, positioning, key_themes, caliber_signals)')
        .eq('id', tailored_resume_id).eq('user_id', user.id).maybeSingle(),
    ]);

    if (!tailoredRow) return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });

    const brief = briefRow?.resume_story_briefs;
    if (!brief) return NextResponse.json({ error: 'Story brief not found for this tailoring' }, { status: 400 });

    // ── 2. Atomize answers into user_experience_memory ──────────────
    // Build a minimal structured fact for each answer so we can insert it
    // as an atom without a full Opus atomization pass (too slow for interactive use).
    // We treat each answer as a skill_usage or achievement atom on the most recent role.

    const { data: recentRole } = await supabase
      .from('user_experience_memory')
      .select('company, role, start_date, end_date')
      .eq('user_id', user.id)
      .order('end_date', { ascending: false })
      .limit(1).maybeSingle();

    const newAtomIds = [];
    for (const { question, answer, role_hint } of answers) {
      if (!answer?.trim() || answer.trim().toLowerCase() === 'no' || answer.trim().toLowerCase() === 'n/a') continue;

      // Use Haiku to extract a clean fact + nugget_type from the Q&A pair
      const extractMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        temperature: 0.1,
        system: `Extract a single resume atom from this Q&A. Output ONLY valid JSON:
{
  "nugget_type": "achievement" | "skill_usage" | "context" | "metric",
  "fact": "<one sentence, third-person neutral, factual — exactly what the person said, no embellishment>",
  "metric": { "value": number, "unit": string } | null,
  "tags": ["<2-4 relevant tags>"],
  "confidence": 0.75
}
If the answer is vague or doesn't add a real fact, output: {"skip": true}`,
        messages: [{ role: 'user', content: `Question: ${question}\nAnswer: ${answer}` }],
      });

      let extracted;
      try { extracted = tolerantParse(extractMsg.content[0].text); } catch { continue; }
      if (extracted.skip || !extracted.fact) continue;

      const { data: inserted } = await supabase
        .from('user_experience_memory')
        .insert({
          user_id: user.id,
          nugget_type: extracted.nugget_type || 'skill_usage',
          fact: extracted.fact,
          metric: extracted.metric || null,
          tags: extracted.tags || [],
          confidence: extracted.confidence || 0.75,
          company: role_hint || recentRole?.company || null,
          role: recentRole?.role || null,
          start_date: recentRole?.start_date || null,
          end_date: recentRole?.end_date || null,
          source_type: 'chat_extraction',
        })
        .select('id').single();

      if (inserted?.id) newAtomIds.push(inserted.id);
    }

    if (!newAtomIds.length) {
      return NextResponse.json({ skipped: true, reason: 'No usable facts extracted from answers' });
    }

    // ── 3. Re-run selection with expanded atom pool ─────────────────
    const { data: allAtoms } = await supabase
      .from('user_experience_memory')
      .select('id, nugget_type, company, role, start_date, end_date, fact, metric, tags, confidence')
      .eq('user_id', user.id)
      .gte('confidence', 0.6);

    const validIds = new Set(allAtoms.map((a) => a.id));
    const atomsById = new Map(allAtoms.map((a) => [a.id, a]));

    // Load cluster from either job_descriptions (RolePitch) or job_matches (CareerPilot)
    let cluster = null;
    if (jd_id) {
      cluster = await ensureJdCluster(supabase, jd_id);
    } else {
      const { data: matchRow } = await supabase
        .from('job_matches')
        .select('jobs(cluster_id, seniority_band, cluster_confidence)')
        .eq('id', match_id).eq('user_id', user.id).maybeSingle();
      cluster = matchRow?.jobs
        ? { cluster_id: matchRow.jobs.cluster_id, seniority_band: matchRow.jobs.seniority_band, cluster_confidence: matchRow.jobs.cluster_confidence }
        : null;
    }

    const { system: selSys, user: selUser } = buildResumeSelectAtomsPrompt({ brief, cluster, atoms: allAtoms });
    const selMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      temperature: 0.2,
      system: selSys,
      messages: [{ role: 'user', content: selUser }],
    });
    const selParsed = tolerantParse(selMsg.content[0].text);
    const cleanedSelections = (selParsed.selections || []).map((s) => ({
      company: s.company, role: s.role,
      atom_ids: (s.atom_ids || []).filter((id) => validIds.has(id)),
    }));

    // ── 4. Re-compose ───────────────────────────────────────────────
    const roleGroups = cleanedSelections
      .map((sel) => ({
        company: sel.company, role: sel.role,
        atoms: sel.atom_ids.map((id) => atomsById.get(id)).filter(Boolean).map((a) => ({
          id: a.id, type: a.nugget_type, fact: a.fact, metric: a.metric, tags: a.tags,
          start_date: a.start_date, end_date: a.end_date,
        })),
      }))
      .filter((g) => g.atoms.length > 0);

    const { system: compSys, user: compUser } = buildResumeComposePrompt({ brief, roleGroups });
    const compMsg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      temperature: 0.4,
      system: compSys,
      messages: [{ role: 'user', content: compUser }],
    });
    const compParsed = tolerantParse(compMsg.content[0].text);

    // ── 5. Group + validate ─────────────────────────────────────────
    const groupKey = (c, r) => `${(c || '').toLowerCase()}::${(r || '').toLowerCase()}`;
    const grouped = new Map();
    for (const g of roleGroups) grouped.set(groupKey(g.company, g.role), { company: g.company, role: g.role, bullets: [] });

    let bulletsFailed = 0, bulletsOverBudget = 0;
    for (const b of compParsed.bullets || []) {
      const v = validateBullet(b, atomsById);
      if (!v.ok) bulletsFailed++;
      if (v.over_budget) bulletsOverBudget++;
      const slot = grouped.get(groupKey(b.company, b.role));
      if (!slot) continue;
      slot.bullets.push({
        text: b.text, cited_atom_ids: b.cited_atom_ids || [], validation: v,
        source_atom_facts: (b.cited_atom_ids || []).map((id) => atomsById.get(id)?.fact).filter(Boolean),
        is_new: (b.cited_atom_ids || []).some((id) => newAtomIds.includes(id)),
      });
    }
    const bulletsByRole = [...grouped.values()].filter((g) => g.bullets.length > 0);

    // ── 6. Stitch + persist ─────────────────────────────────────────
    const stitched = stitchTailoredResume(tailoredRow.base_version, bulletsByRole);
    const allSelectedAtomIds = cleanedSelections.flatMap((s) => s.atom_ids);

    await supabase.from('tailored_resumes').update({
      tailored_version: stitched,
      selected_atom_ids: allSelectedAtomIds,
      updated_at: new Date().toISOString(),
    }).eq('id', tailored_resume_id);

    return NextResponse.json({
      tailored_resume_id,
      bullets_by_role: bulletsByRole,
      new_atom_ids: newAtomIds,
      stats: {
        new_atoms: newAtomIds.length,
        bullets_total: (compParsed.bullets || []).length,
        bullets_failed: bulletsFailed,
        bullets_over_budget: bulletsOverBudget,
      },
      tokens: {
        select: selMsg.usage,
        compose: compMsg.usage,
      },
    });
  } catch (err) {
    console.error('[resume-tailor-v2/refine]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
