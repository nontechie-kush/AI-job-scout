/**
 * backfill-atoms.mjs
 *
 * One-off script for Resume Tailor v2 Phase A.4 — atomizes a user's
 * existing structured_resume into user_experience_memory rows. Use this
 * for any user whose profile was structured before atomization auto-fired
 * in the upload flow.
 *
 * Usage:
 *   node scripts/backfill-atoms.mjs --email user@example.com [--force]
 *   node scripts/backfill-atoms.mjs --user-id <uuid> [--force]
 *
 * --force wipes existing original_resume atoms for the profile and re-runs.
 *
 * Requires .env.local: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 *
 * Note: this script bypasses RLS via the service role key. Atom inserts
 * still carry the correct user_id so RLS-protected reads work afterward.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { buildResumeAtomizePrompt } from '../src/lib/ai/prompts/resume-atomize.js';

// ── Load .env.local ──
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}
const email = getArg('--email');
const userIdArg = getArg('--user-id');
const force = args.includes('--force');

if (!email && !userIdArg) {
  console.error('Usage: node scripts/backfill-atoms.mjs --email <email> [--force]');
  process.exit(1);
}

// ── Helpers (mirror src/lib/ai/atomize-resume.js) ──
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

// ── Resolve user ──
let userId = userIdArg;
if (!userId) {
  console.log(`Resolving user_id for ${email}...`);
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('listUsers failed:', listErr.message);
    process.exit(1);
  }
  const match = (list?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!match) {
    console.error(`No auth user found for ${email}`);
    process.exit(1);
  }
  userId = match.id;
  console.log(`  user_id: ${userId}`);
}

// ── Load profile ──
const { data: profile, error: profErr } = await supabase
  .from('profiles')
  .select('id, structured_resume, knowledge_base_version')
  .eq('user_id', userId)
  .order('parsed_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (profErr) {
  console.error('profile load failed:', profErr.message);
  process.exit(1);
}
if (!profile) {
  console.error('No profile found for this user');
  process.exit(1);
}
if (!profile.structured_resume) {
  console.error('Profile has no structured_resume — run /api/ai/resume-structure first');
  process.exit(1);
}

const expCount = (profile.structured_resume.experience || []).length;
const projCount = (profile.structured_resume.projects || []).length;
const bulletCount =
  [...(profile.structured_resume.experience || []), ...(profile.structured_resume.projects || [])]
    .reduce((sum, e) => sum + (e.bullets || []).length, 0);
console.log(`Profile ${profile.id}: ${expCount} experience, ${projCount} projects, ${bulletCount} bullets total`);

// ── Idempotency check ──
const { count: existingCount } = await supabase
  .from('user_experience_memory')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('source_type', 'original_resume')
  .eq('source_profile_id', profile.id);

if ((existingCount || 0) > 0 && !force) {
  console.log(`Already has ${existingCount} original_resume atoms for this profile. Re-run with --force to wipe and re-atomize.`);
  process.exit(0);
}

// ── Atomize ──
console.log('Calling Opus to atomize...');
const { system, user: userPrompt } = buildResumeAtomizePrompt(profile.structured_resume);

const aiMessage = await anthropic.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 8000,
  temperature: 0.2,
  system,
  messages: [{ role: 'user', content: userPrompt }],
});

if (aiMessage.stop_reason === 'max_tokens') {
  console.warn('WARNING: hit max_tokens — output likely truncated');
}

const usage = aiMessage.usage || {};
console.log(`  tokens: in=${usage.input_tokens} out=${usage.output_tokens}`);

const rawText = aiMessage.content[0].text.trim();
const parsed = tolerantParse(rawText);
const atoms = Array.isArray(parsed.atoms) ? parsed.atoms : [];
console.log(`  parsed ${atoms.length} atoms from output`);

if (!atoms.length) {
  console.error('Model returned no atoms');
  process.exit(1);
}

// ── Wipe if forcing ──
if (force) {
  console.log('--force: wiping existing original_resume atoms...');
  const { error: delErr } = await supabase
    .from('user_experience_memory')
    .delete()
    .eq('user_id', userId)
    .eq('source_type', 'original_resume')
    .eq('source_profile_id', profile.id);
  if (delErr) {
    console.error('wipe failed:', delErr.message);
    process.exit(1);
  }
}

// ── Insert ──
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

console.log(`Inserting ${toInsert.length} atoms...`);
const { data: inserted, error: insertErr } = await supabase
  .from('user_experience_memory')
  .insert(toInsert)
  .select('id, nugget_type, company, role, fact, tags, source_bullet_id');

if (insertErr) {
  console.error('insert failed:', insertErr.message);
  process.exit(1);
}

// ── Bump knowledge_base_version ──
await supabase
  .from('profiles')
  .update({ knowledge_base_version: (profile.knowledge_base_version || 1) + 1 })
  .eq('id', profile.id);

console.log(`\n✓ Atomized ${inserted.length} atoms\n`);

// ── Summary by type + sample ──
const byType = inserted.reduce((acc, a) => {
  acc[a.nugget_type] = (acc[a.nugget_type] || 0) + 1;
  return acc;
}, {});
console.log('By type:', byType);

console.log('\nSample atoms:');
for (const a of inserted.slice(0, 5)) {
  console.log(`  [${a.nugget_type}] ${a.company || '—'} • ${a.fact.slice(0, 100)}${a.fact.length > 100 ? '…' : ''}`);
  console.log(`    tags: ${(a.tags || []).join(', ')}  source_bullet: ${a.source_bullet_id}`);
}
