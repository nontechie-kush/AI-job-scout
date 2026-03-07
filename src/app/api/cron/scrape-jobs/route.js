/**
 * GET /api/cron/scrape-jobs
 *
 * Vercel Cron job — runs every 4 hours.
 * Protected by CRON_SECRET header (set in vercel.json + .env.local).
 *
 * Runs all scrapers via circuit breaker, upserts results into jobs table.
 * Returns aggregate stats per source.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runAllScrapers } from '@/lib/scrapers/index';

export const maxDuration = 300; // 5 min Vercel function timeout (Pro plan)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Auth: CRON_SECRET header (set by Vercel Cron automatically, or manually for local testing)
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();

  try {
    console.log('[cron/scrape-jobs] starting scrape run');
    const results = await runAllScrapers(supabase);

    const totalScraped = Object.values(results).reduce((sum, r) => sum + (r.scraped || 0), 0);
    const totalInserted = Object.values(results).reduce((sum, r) => sum + (r.inserted || 0), 0);
    const totalUpdated = Object.values(results).reduce((sum, r) => sum + (r.updated || 0), 0);
    const skipped = Object.entries(results)
      .filter(([, r]) => r.skipped)
      .map(([s]) => s);
    const errors = Object.entries(results)
      .filter(([, r]) => r.error)
      .map(([s, r]) => `${s}: ${r.error}`);

    const summary = {
      duration_ms: Date.now() - startedAt,
      total_scraped: totalScraped,
      total_inserted: totalInserted,
      total_updated: totalUpdated,
      skipped_sources: skipped,
      error_sources: errors,
      per_source: results,
    };

    console.log('[cron/scrape-jobs] done:', JSON.stringify({ totalScraped, totalInserted, totalUpdated, errors }));
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[cron/scrape-jobs] fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
