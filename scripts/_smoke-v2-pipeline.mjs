/**
 * End-to-end smoke test for the v2 pipeline.
 *
 * Runs all 5 passes against a real job_match using direct prompt+model calls
 * (the routes themselves require auth cookies which we don't have in scripts).
 *
 * Usage:
 *   node scripts/_smoke-v2-pipeline.mjs <match_id>
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { buildClusterClassifyPrompt } from '../src/lib/ai/prompts/job-cluster-classify.js';
import { buildResumeStoryBriefPrompt } from '../src/lib/ai/prompts/resume-story-brief.js';
import { buildResumeSelectAtomsPrompt } from '../src/lib/ai/prompts/resume-select-atoms.js';
import { buildResumeComposePrompt } from '../src/lib/ai/prompts/resume-compose.js';

const matchId = process.argv[2];
if (!matchId) {
  console.error('Usage: node scripts/_smoke-v2-pipeline.mjs <match_id>');
  process.exit(1);
}

const cwd = '/Users/kushendrasuryavanshi/Documents/claude code/AI job agent/careerpilot-ai';
const envFile = fs.readFileSync(path.join(cwd, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function tolerantParse(rawText) {
  const stripped = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim();
  try { return JSON.parse(stripped); } catch {
    const f = stripped.indexOf('{'); const l = stripped.lastIndexOf('}');
    if (f === -1 || l <= f) throw new Error('unparseable');
    return JSON.parse(stripped.slice(f, l + 1));
  }
}

function extractNumericTokens(text) {
  const tokens = new Set();
  const KNOWN_UNITS = '(?:%|x|X|k|K|m|M|b|B|cr|lakh|crore|crores|hr|hrs|day|days|wk|weeks|mo|months|yr|yrs)';
  const re = new RegExp(`([\\₹\\$€£]?\\d+(?:[\\.,]\\d+)?\\+?${KNOWN_UNITS}?)`, 'g');
  for (const match of text.matchAll(re)) {
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

// ── 1. Load match + job ──
const { data: match } = await supabase
  .from('job_matches')
  .select('id, user_id, jobs(id, title, company, description, cluster_id, seniority_band, cluster_confidence)')
  .eq('id', matchId)
  .maybeSingle();
if (!match) { console.error('Match not found'); process.exit(1); }
const { user_id: userId } = match;
const job = match.jobs;
console.log(`\n━━━ TARGET ━━━`);
console.log(`${job.title} @ ${job.company}`);
console.log(`Match: ${matchId}\n`);

// ── 2. Cluster classify (or use cached) ──
console.log(`━━━ STEP 1: Cluster Classify ━━━`);
let cluster;
if (job.cluster_id && job.seniority_band) {
  console.log(`  CACHED → ${job.cluster_id} / ${job.seniority_band} (conf ${job.cluster_confidence})\n`);
  cluster = { cluster_id: job.cluster_id, seniority_band: job.seniority_band, cluster_confidence: job.cluster_confidence };
} else {
  const { system, user } = buildClusterClassifyPrompt({ title: job.title, company: job.company, description: job.description });
  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, temperature: 0.1, system, messages: [{ role: 'user', content: user }] });
  const parsed = tolerantParse(msg.content[0].text);
  cluster = { cluster_id: parsed.cluster_id, seniority_band: parsed.seniority_band, cluster_confidence: parsed.confidence };
  await supabase.from('jobs').update(cluster).eq('id', job.id);
  console.log(`  → ${cluster.cluster_id} / ${cluster.seniority_band} (conf ${cluster.cluster_confidence})`);
  console.log(`  themes: ${(parsed.themes_detected || []).join(', ')}`);
  console.log(`  tokens: in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}\n`);
}

// ── 3. Story brief ──
console.log(`━━━ STEP 2: Story Brief ━━━`);
const { data: profile } = await supabase.from('profiles').select('knowledge_base_version').eq('user_id', userId).order('parsed_at', {ascending:false}).limit(1).maybeSingle();
const kbv = profile?.knowledge_base_version || 1;

let brief;
const { data: cachedBrief } = await supabase
  .from('resume_story_briefs')
  .select('id, positioning, key_themes, caliber_signals, knowledge_base_version')
  .eq('user_id', userId)
  .eq('cluster_id', cluster.cluster_id)
  .eq('seniority_band', cluster.seniority_band)
  .maybeSingle();

if (cachedBrief && cachedBrief.knowledge_base_version >= kbv) {
  brief = cachedBrief;
  console.log(`  CACHED brief (id=${brief.id})\n`);
} else {
  const { data: atomsForBrief } = await supabase
    .from('user_experience_memory')
    .select('company, role, start_date, end_date, tags')
    .eq('user_id', userId).gte('confidence', 0.6);

  // Build summary
  const byRole = new Map();
  for (const a of atomsForBrief) {
    const k = `${a.company || '—'}::${a.role || '—'}`;
    if (!byRole.has(k)) byRole.set(k, { company: a.company, role: a.role, start_date: a.start_date, end_date: a.end_date, atom_count: 0, tag_counts: {} });
    const e = byRole.get(k); e.atom_count++;
    for (const t of a.tags || []) e.tag_counts[t] = (e.tag_counts[t] || 0) + 1;
  }
  const summary = [...byRole.values()].sort((a,b) => (b.end_date||'9999').localeCompare(a.end_date||'9999')).map(r => ({
    company: r.company, role: r.role, start_date: r.start_date, end_date: r.end_date, atom_count: r.atom_count,
    top_tags: Object.entries(r.tag_counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t])=>t)
  }));

  const { system, user } = buildResumeStoryBriefPrompt({ job: { ...job, ...cluster }, atomSummary: summary });
  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, temperature: 0.3, system, messages: [{ role: 'user', content: user }] });
  const parsed = tolerantParse(msg.content[0].text);

  const { data: upserted } = await supabase
    .from('resume_story_briefs')
    .upsert({
      user_id: userId, cluster_id: cluster.cluster_id, seniority_band: cluster.seniority_band,
      positioning: parsed.positioning, key_themes: parsed.key_themes, caliber_signals: parsed.caliber_signals,
      knowledge_base_version: kbv, source_match_ids: [matchId], updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,cluster_id,seniority_band' })
    .select('id, positioning, key_themes, caliber_signals')
    .single();
  brief = upserted;
  console.log(`  FRESH brief (id=${brief.id})  tokens: in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}\n`);
}

console.log(`  POSITIONING:`);
console.log(`    ${brief.positioning}\n`);
console.log(`  KEY THEMES: ${brief.key_themes.join(', ')}`);
console.log(`  CALIBER SIGNALS:`);
for (const c of brief.caliber_signals) console.log(`    • ${c}`);
console.log();

// ── 4. Selection ──
console.log(`━━━ STEP 3: Atom Selection ━━━`);
const { data: allAtoms } = await supabase
  .from('user_experience_memory')
  .select('id, nugget_type, company, role, start_date, end_date, fact, metric, tags, confidence')
  .eq('user_id', userId).gte('confidence', 0.6);

const { system: selSys, user: selUser } = buildResumeSelectAtomsPrompt({ brief, cluster, atoms: allAtoms });
const selMsg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 2500, temperature: 0.2, system: selSys, messages: [{ role: 'user', content: selUser }] });
const selParsed = tolerantParse(selMsg.content[0].text);
const validIds = new Set(allAtoms.map(a => a.id));
const cleanedSelections = (selParsed.selections || []).map(s => ({ company: s.company, role: s.role, atom_ids: (s.atom_ids || []).filter(id => validIds.has(id)) }));
const droppedAtoms = (selParsed.dropped_atoms || []).filter(d => validIds.has(d.id));

console.log(`  tokens: in=${selMsg.usage.input_tokens} out=${selMsg.usage.output_tokens}`);
console.log(`  Selected ${cleanedSelections.reduce((s,r)=>s+r.atom_ids.length,0)}/${allAtoms.length}, dropped ${droppedAtoms.length}\n`);
const atomsById = new Map(allAtoms.map(a => [a.id, a]));
for (const sel of cleanedSelections) {
  console.log(`  ${sel.company} • ${sel.role}  (${sel.atom_ids.length} atoms)`);
  for (const id of sel.atom_ids) {
    const a = atomsById.get(id);
    console.log(`    - [${a.nugget_type}] ${a.fact.slice(0, 90)}${a.fact.length > 90 ? '…' : ''}`);
  }
}
console.log(`\n  Dropped (top 5):`);
for (const d of droppedAtoms.slice(0, 5)) {
  const a = atomsById.get(d.id);
  console.log(`    - [${d.reason}] ${a.fact.slice(0, 80)}…`);
}
console.log();

// ── 5. Composition ──
console.log(`━━━ STEP 4: Composition ━━━`);
const roleGroups = cleanedSelections.map(sel => ({
  company: sel.company, role: sel.role,
  atoms: sel.atom_ids.map(id => atomsById.get(id)).filter(Boolean).map(a => ({
    id: a.id, type: a.nugget_type, fact: a.fact, metric: a.metric, tags: a.tags, start_date: a.start_date, end_date: a.end_date,
  })),
})).filter(g => g.atoms.length > 0);

const { system: compSys, user: compUser } = buildResumeComposePrompt({ brief, roleGroups });
const compMsg = await anthropic.messages.create({ model: 'claude-opus-4-6', max_tokens: 3000, temperature: 0.4, system: compSys, messages: [{ role: 'user', content: compUser }] });
const compParsed = tolerantParse(compMsg.content[0].text);

console.log(`  tokens: in=${compMsg.usage.input_tokens} out=${compMsg.usage.output_tokens}`);
console.log(`  Composed ${(compParsed.bullets || []).length} bullets\n`);

// Validate
let failed = 0, overBudget = 0;
const allHydrated = new Map(allAtoms.map(a => [a.id, a]));
for (const b of compParsed.bullets || []) {
  const cited = (b.cited_atom_ids || []).map(id => allHydrated.get(id));
  const issues = [];
  if (cited.some(a => !a)) issues.push('phantom_citation');
  if (!cited.length) issues.push('no_citations');
  const numbers = extractNumericTokens(b.text);
  for (const n of numbers) if (!cited.some(a => a && isTokenCovered(n, a))) issues.push(`unsourced:${n}`);
  const wc = b.text.trim().split(/\s+/).length;
  const ok = issues.length === 0;
  if (!ok) failed++;
  if (wc > 22) overBudget++;
  const flag = ok ? '✓' : '✗';
  const wcFlag = wc > 22 ? `[${wc}w!]` : `[${wc}w]`;
  console.log(`  ${flag} ${wcFlag} ${b.text}`);
  if (!ok) console.log(`         ISSUES: ${issues.join(' | ')}`);
  console.log(`         cites: ${(b.cited_atom_ids || []).join(', ')}`);
}
console.log(`\n  Failed validation: ${failed}/${(compParsed.bullets || []).length}`);
console.log(`  Over budget (>22w): ${overBudget}/${(compParsed.bullets || []).length}`);

// Cost summary
const haikuInput = (selMsg.usage.input_tokens || 0);
const haikuOutput = (selMsg.usage.output_tokens || 0);
const opusInput = (compMsg.usage.input_tokens || 0);
const opusOutput = (compMsg.usage.output_tokens || 0);
// Haiku: $0.80/MTok in, $4/MTok out. Opus: $15/MTok in, $75/MTok out
const haikuCost = (haikuInput / 1e6) * 0.80 + (haikuOutput / 1e6) * 4;
const opusCost = (opusInput / 1e6) * 15 + (opusOutput / 1e6) * 75;
console.log(`\n━━━ COST (this tailoring) ━━━`);
console.log(`  Haiku selection: $${haikuCost.toFixed(4)}`);
console.log(`  Opus compose:    $${opusCost.toFixed(4)}`);
console.log(`  Total:           $${(haikuCost + opusCost).toFixed(4)}`);
