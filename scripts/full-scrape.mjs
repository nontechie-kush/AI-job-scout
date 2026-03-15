/**
 * Full scrape for specific sources — upserts ALL jobs (no limit).
 * Usage: node --experimental-loader ./scripts/alias-loader.mjs scripts/full-scrape.mjs naukri instahyre
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
}

import { createServiceClient } from '@/lib/supabase/service-client';
import { upsertJobs } from '@/lib/scrapers/index';
import { scrapeNaukri }   from '@/lib/scrapers/naukri';
import { scrapeInstahyre } from '@/lib/scrapers/instahyre';

const SCRAPERS = { naukri: scrapeNaukri, instahyre: scrapeInstahyre };

const targets = process.argv.slice(2);
const toRun = targets.length
  ? Object.fromEntries(targets.map(t => [t, SCRAPERS[t]]).filter(([,v]) => v))
  : SCRAPERS;

if (!Object.keys(toRun).length) {
  console.error(`Unknown scrapers. Options: ${Object.keys(SCRAPERS).join(', ')}`);
  process.exit(1);
}

const supabase = createServiceClient();

// Fetch users for Naukri clusters
const { data: users } = await supabase
  .from('users')
  .select('target_roles, locations, profiles(parsed_json)')
  .eq('onboarding_completed', true)
  .limit(200);
console.log(`[full-scrape] ${users?.length ?? 0} active users loaded for Naukri clusters\n`);

const results = [];

for (const [name, fn] of Object.entries(toRun)) {
  console.log(`\n── ${name} ────────────────────────────`);
  try {
    const jobs = name === 'naukri'    ? await fn(users || [], { maxClusters: 50 })
               : name === 'instahyre' ? await fn(users || [])
               : await fn();
    if (!jobs.length) {
      console.log(`0 jobs scraped ⚠`);
      results.push({ name, jobs: 0, status: 'empty' });
      continue;
    }
    console.log(`Scraped ${jobs.length} jobs — upserting all...`);
    const { inserted, updated, errors } = await upsertJobs(supabase, jobs);
    const status = errors === 0 ? '✓' : '✗';
    console.log(`inserted=${inserted} updated=${updated} errors=${errors} ${status}`);
    results.push({ name, jobs: jobs.length, inserted, updated, errors, status: errors === 0 ? 'ok' : 'error' });
  } catch (err) {
    console.log(`CRASHED: ${err.message} ✗`);
    results.push({ name, jobs: 0, status: 'crash', error: err.message });
  }
}

console.log('\n── Final Summary ────────────────────');
for (const r of results) {
  const icon = r.status === 'ok' ? '✓' : r.status === 'empty' ? '⚠' : '✗';
  const detail = r.inserted != null ? `  inserted=${r.inserted} updated=${r.updated} errors=${r.errors}` : '';
  console.log(`${icon} ${r.name.padEnd(12)} ${r.jobs} jobs${detail}`);
}
