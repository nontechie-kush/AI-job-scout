/**
 * analyze-recruiters.mjs
 *
 * Queries the recruiters table and prints a breakdown of:
 *   - Top companies (current_company)
 *   - Type: agency vs inhouse
 *   - Geography
 *   - Specialization
 *   - Data completeness (bio, email, location)
 *
 * Usage: node scripts/analyze-recruiters.mjs
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function top(map, n = 15) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function bar(count, max, width = 20) {
  const filled = Math.round((count / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function main() {
  const { data: recruiters, error } = await supabase
    .from('recruiters')
    .select('current_company, type, geography, specialization, industry_focus, seniority_levels, cities, email, bio, location')
    .order('created_at', { ascending: false });

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  const total = recruiters.length;
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  RECRUITER DATABASE ANALYSIS  (${total} total)`);
  console.log(`${'═'.repeat(55)}\n`);

  // ── Companies ──────────────────────────────────────────────
  const companies = {};
  for (const r of recruiters) {
    const c = (r.current_company || 'Unknown').trim();
    companies[c] = (companies[c] || 0) + 1;
  }
  const topCompanies = top(companies, 20);
  const maxC = topCompanies[0]?.[1] || 1;
  console.log('TOP COMPANIES (current_company)');
  console.log('─'.repeat(55));
  for (const [name, count] of topCompanies) {
    console.log(`  ${bar(count, maxC, 15)}  ${count.toString().padStart(3)}  ${name}`);
  }
  console.log(`  ... ${Object.keys(companies).length} unique companies total\n`);

  // ── Type breakdown ─────────────────────────────────────────
  const types = {};
  for (const r of recruiters) types[r.type || 'unknown'] = (types[r.type || 'unknown'] || 0) + 1;
  console.log('TYPE BREAKDOWN');
  console.log('─'.repeat(55));
  for (const [t, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bar(count, total, 20)}  ${count.toString().padStart(3)} (${((count/total)*100).toFixed(1)}%)  ${t}`);
  }
  console.log();

  // ── Geography ──────────────────────────────────────────────
  const geos = {};
  for (const r of recruiters) {
    for (const g of (r.geography || [])) geos[g] = (geos[g] || 0) + 1;
  }
  console.log('GEOGRAPHY');
  console.log('─'.repeat(55));
  for (const [g, count] of top(geos, 10)) {
    console.log(`  ${bar(count, total, 20)}  ${count.toString().padStart(3)}  ${g}`);
  }
  console.log();

  // ── Specialization ─────────────────────────────────────────
  const specs = {};
  for (const r of recruiters) {
    for (const s of (r.specialization || [])) specs[s] = (specs[s] || 0) + 1;
  }
  console.log('SPECIALIZATION');
  console.log('─'.repeat(55));
  for (const [s, count] of top(specs, 10)) {
    console.log(`  ${bar(count, total, 20)}  ${count.toString().padStart(3)}  ${s}`);
  }
  console.log();

  // ── Seniority levels ───────────────────────────────────────
  const seniority = {};
  for (const r of recruiters) {
    for (const s of (r.seniority_levels || [])) seniority[s] = (seniority[s] || 0) + 1;
  }
  console.log('SENIORITY LEVELS THEY RECRUIT FOR');
  console.log('─'.repeat(55));
  for (const [s, count] of top(seniority, 10)) {
    console.log(`  ${bar(count, total, 20)}  ${count.toString().padStart(3)}  ${s}`);
  }
  console.log();

  // ── Data completeness ──────────────────────────────────────
  const hasEmail   = recruiters.filter(r => r.email).length;
  const hasBio     = recruiters.filter(r => r.bio).length;
  const hasLoc     = recruiters.filter(r => r.location).length;
  console.log('DATA COMPLETENESS');
  console.log('─'.repeat(55));
  console.log(`  Email    ${bar(hasEmail, total, 20)}  ${hasEmail}/${total} (${((hasEmail/total)*100).toFixed(1)}%)`);
  console.log(`  Bio      ${bar(hasBio, total, 20)}  ${hasBio}/${total} (${((hasBio/total)*100).toFixed(1)}%)`);
  console.log(`  Location ${bar(hasLoc, total, 20)}  ${hasLoc}/${total} (${((hasLoc/total)*100).toFixed(1)}%)`);
  console.log();
}

main().catch(err => { console.error(err); process.exit(1); });
