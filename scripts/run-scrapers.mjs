/**
 * Standalone scraper runner — for GitHub Actions.
 *
 * Runs all scrapers with circuit breaker, upserts jobs into Supabase.
 * Equivalent to GET /api/cron/scrape-jobs but with no Vercel timeout.
 *
 * Usage (from repo root):
 *   node --experimental-loader ./scripts/alias-loader.mjs scripts/run-scrapers.mjs
 *
 * Required env vars (set in GitHub Actions secrets):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SCRAPERAPI_KEY          (optional — enables Naukri, IIMJobs, YC, Instahyre)
 *   ANTHROPIC_API_KEY       (not needed for scraping, but scripts share env)
 */

import { createClient } from '@supabase/supabase-js';

// Validate required env vars
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[run-scrapers] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Import scraper registry (needs alias-loader for @/ resolution)
const { runAllScrapers } = await import('../src/lib/scrapers/index.js');

// Create Supabase client for upsertJobs (circuit-breaker creates its own internally)
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('[run-scrapers] starting all scrapers...');
const startedAt = Date.now();

try {
  const results = await runAllScrapers(supabase);

  const totalInserted = Object.values(results).reduce((s, r) => s + (r.inserted || 0), 0);
  const totalUpdated  = Object.values(results).reduce((s, r) => s + (r.updated || 0), 0);
  const totalErrors   = Object.values(results).reduce((s, r) => s + (r.errors || 0), 0);

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[run-scrapers] done in ${durationSec}s`);
  console.log(`[run-scrapers] ${totalInserted} inserted, ${totalUpdated} updated, ${totalErrors} errors`);
  console.log('[run-scrapers] per-source results:');
  for (const [source, result] of Object.entries(results)) {
    if (result.skipped) {
      console.log(`  ${source}: SKIPPED (${result.reason})`);
    } else if (result.error) {
      console.log(`  ${source}: ERROR — ${result.error}`);
    } else {
      console.log(`  ${source}: ${result.scraped ?? 0} scraped, ${result.inserted ?? 0} new, ${result.updated ?? 0} updated`);
    }
  }
} catch (err) {
  console.error('[run-scrapers] fatal:', err);
  process.exit(1);
}
