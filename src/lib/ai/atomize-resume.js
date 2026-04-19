/**
 * Atomization helper — converts a structured_resume into atoms in
 * user_experience_memory. Shared by /api/ai/resume-atomize (manual / backfill)
 * and the upload flows that auto-fire it after structuring.
 *
 * Returns { atomized: number, skipped?: string, error?: string }.
 * Never throws — caller can fire-and-forget.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildResumeAtomizePrompt } from './prompts/resume-atomize';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseDate(d) {
  if (!d || typeof d !== 'string') return null;
  if (d.toLowerCase() === 'present') return null;
  if (/^\d{4}$/.test(d)) return `${d}-01-01`;
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

function tolerantParse(rawText) {
  const stripped = rawText
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = (fenced?.[1] || rawText).trim();
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('Atomization output unparseable');
    }
    return JSON.parse(candidate.slice(first, last + 1));
  }
}

/**
 * @param {object} params
 * @param {object} params.supabase — server-side client (RLS-bound to user)
 * @param {string} params.userId
 * @param {object} params.profile — { id, structured_resume, knowledge_base_version }
 * @param {boolean} [params.force=false] — wipe existing original_resume atoms first
 */
export async function atomizeResume({ supabase, userId, profile, force = false }) {
  if (!profile?.structured_resume) {
    return { atomized: 0, skipped: 'no_structured_resume' };
  }

  // Idempotency: skip if atoms already exist for this profile
  if (!force) {
    const { count } = await supabase
      .from('user_experience_memory')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_type', 'original_resume')
      .eq('source_profile_id', profile.id);

    if ((count || 0) > 0) {
      return { atomized: 0, skipped: 'already_atomized', existing_count: count };
    }
  }

  const { system, user: userPrompt } = buildResumeAtomizePrompt(profile.structured_resume);

  const aiMessage = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    temperature: 0.2,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (aiMessage.stop_reason === 'max_tokens') {
    console.warn('[atomize-resume] hit max_tokens — output likely truncated');
  }

  const rawText = aiMessage.content[0].text.trim();
  const parsed = tolerantParse(rawText);

  const atoms = Array.isArray(parsed.atoms) ? parsed.atoms : [];
  if (!atoms.length) {
    return { atomized: 0, skipped: 'no_atoms_returned' };
  }

  if (force) {
    await supabase
      .from('user_experience_memory')
      .delete()
      .eq('user_id', userId)
      .eq('source_type', 'original_resume')
      .eq('source_profile_id', profile.id);
  }

  const toInsert = atoms
    .filter((a) => a.fact && typeof a.fact === 'string')
    .map((a) => ({
      user_id: userId,
      nugget_type: a.nugget_type || 'context',
      company: a.company || null,
      role: a.role || null,
      fact: a.fact,
      metric: a.metric || null,
      tags: Array.isArray(a.tags) ? a.tags : [],
      confidence: typeof a.confidence === 'number' ? a.confidence : 0.95,
      source_type: 'original_resume',
      source_profile_id: profile.id,
      source_bullet_id: a.source_bullet_id || null,
      start_date: parseDate(a.start_date),
      end_date: parseDate(a.end_date),
    }));

  if (!toInsert.length) {
    return { atomized: 0, skipped: 'no_valid_atoms' };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('user_experience_memory')
    .insert(toInsert)
    .select('id, nugget_type, fact, source_bullet_id');

  if (insertErr) {
    console.error('[atomize-resume] insert failed', insertErr);
    return { atomized: 0, error: insertErr.message };
  }

  await supabase
    .from('profiles')
    .update({ knowledge_base_version: (profile.knowledge_base_version || 1) + 1 })
    .eq('id', profile.id);

  return { atomized: inserted?.length || 0, atoms: inserted || [] };
}
