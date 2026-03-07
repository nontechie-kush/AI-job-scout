/**
 * fix-dirty-names.mjs
 *
 * Cleans recruiter names in the DB:
 *   - Strips credential suffixes (SPHR, MBA, PHR, SHRM, etc.)
 *   - Strips pronoun tags (SheHer, HeHimHis, etc.)
 *   - Strips job titles that leaked in ("Specialist Recruiter Technology-Product")
 *   - Strips non-Latin script appended after English name
 *   - Keeps Dr. / Ms. / Mr. prefixes if present
 *   - Max 4 name tokens
 *
 * Usage: node scripts/fix-dirty-names.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Tokens that signal "stop here — everything after is not a name"
const STOP_WORDS = new Set([
  'sphr','gphr','phr','bhr','mba','shrm','cipd','chrl','chrp','pmp','odcp','cphr',
  'chrm','ccrp','gcil','cpp','rpr','cdsp','airs','shrm-scp','shrm-cp',
  'dr','ms','mr','mrs',  // these are OK as PREFIX only — handled separately
  'forbes','hbr','hrd','certified','specialist','recruiter','head','manager',
  'director','lead','senior','junior','associate',
  'connections','techsales','technology','product',
  'j.d.','ll.b','ll.m','ph.d','hon.', 'jr.', 'sr.',
]);

// Allowed honorific prefixes (only at position 0)
const HONORIFICS = new Set(['dr', 'dr.', 'ms', 'ms.', 'mr', 'mr.', 'mrs', 'mrs.', 'prof', 'prof.']);

function cleanName(raw) {
  if (!raw) return '';

  // Step 1: strip non-Latin characters (Arabic, Chinese, Devanagari, bold Unicode, etc.)
  // Keep Latin extended (\u0000-\u024F), spaces, hyphens, apostrophes, dots
  let name = raw.replace(/[^\u0000-\u024F\s\-'.]/g, ' ').replace(/\s+/g, ' ').trim();

  // Step 2: split on word-boundary separators only (space + dash + space, pipe, etc.)
  // Do NOT split on hyphen-in-word (Watts-Porter stays together)
  name = name.split(/\s+[-|–—·•]\s+|\s+[|–—·•]\s*/)[0].trim();

  // Step 3: handle no-space honorific (Ms.Tamam → "Ms. Tamam")
  name = name.replace(/^(Dr|Ms|Mr|Mrs|Prof)\./i, '$1. ').trim();

  // Step 4: tokenize and stop at credential/stop words
  const tokens = name.split(/\s+/);
  const clean = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const tl = t.toLowerCase().replace(/[^a-z]/g, ''); // strip non-alpha for comparison

    // Allow honorific at position 0
    if (i === 0 && HONORIFICS.has(t.toLowerCase().replace(/\.$/, ''))) { clean.push(t); continue; }

    // Stop if token starts with 2+ uppercase letters and has no lowercase
    // (catches SPHR, SPHRGPHRBHRPHRForbes, MBA, CPC, etc.)
    if (/^[A-Z]{2}/.test(t) && !/[a-z]/.test(t)) break;

    // Stop if token STARTS with all-caps credential (SPHRGPHRBHRPHRForbes has no lowercase until Forbes)
    // Actually covered above since SPHRGPHRBHRPHRForbes has no lowercase at all? Wait, Forbes has lowercase
    // Extra check: starts with 3+ uppercase, even if followed by lowercase (compound smash like SPHRGPHRBHRPHRForbes)
    if (/^[A-Z]{3,}[A-Za-z]*$/.test(t) && !/^[A-Z][a-z]/.test(t)) break;

    // Stop on known credential/stop words
    if (STOP_WORDS.has(tl)) break;

    // Stop on pronoun identity tags (SheHer, He/Him/His, TheyThem, etc.)
    // Must be an explicit pronoun tag — don't catch "Shetty", "Shepherd", etc.
    if (/^(She\/?Her|He\/?Him(\/His)?|They\/?Them|SheHer|HeHim(His)?|TheyThem)/i.test(t)) break;
    // Also stop on long pronoun smashes like "HeHimHisConnections"
    if (/^He(Him|Her)|^She(Her)|^They(Them)/i.test(t) && t.length > 8) break;

    // Stop if token is C-KPI style credential (single letter dash credential)
    if (/^[A-Z]-[A-Z]{2,}$/.test(t)) break;

    clean.push(t);

    // Max 4 meaningful tokens (not counting honorific)
    const nameTokens = clean.filter(x => !HONORIFICS.has(x.toLowerCase().replace(/[^a-z]/g, '')));
    if (nameTokens.length >= 4) break;
  }

  return clean.join(' ').trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { data, error } = await supabase
  .from('recruiters')
  .select('id, name');

if (error) { console.error(error.message); process.exit(1); }

const updates = [];
for (const r of data) {
  const fixed = cleanName(r.name);
  if (fixed !== r.name && fixed.length > 0) {
    updates.push({ id: r.id, old: r.name, new: fixed });
  }
}

console.log(`\nNames to fix: ${updates.length} / ${data.length}`);
updates.forEach(u => console.log(`  "${u.old}"\n    → "${u.new}"\n`));

if (DRY_RUN) {
  console.log('\n[DRY RUN] No changes written.');
  process.exit(0);
}

if (!updates.length) {
  console.log('Nothing to update.');
  process.exit(0);
}

// Apply updates
let fixed = 0;
for (const u of updates) {
  const { error: updateError } = await supabase
    .from('recruiters')
    .update({ name: u.new })
    .eq('id', u.id);
  if (updateError) console.error(`  Failed ${u.id}: ${updateError.message}`);
  else fixed++;
}

console.log(`\nDone. Fixed ${fixed} names.`);
