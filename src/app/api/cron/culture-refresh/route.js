/**
 * GET /api/cron/culture-refresh
 *
 * Vercel Cron — runs daily at 2am.
 * Refreshes job_intelligence for company domains that have active jobs
 * and haven't been refreshed in the last 24 hours.
 *
 * Per company:
 *   1. Compute hiring_velocity_30d from jobs table
 *   2. Scrape Glassdoor (non-throwing, returns null on failure)
 *   3. Scrape AmbitionBox (non-throwing, returns null on failure)
 *   4. If any data → call Claude to synthesize Pilot culture read
 *   5. Upsert into job_intelligence
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { scrapeGlassdoor } from '@/lib/scrapers/glassdoor';
import { scrapeAmbitionBox } from '@/lib/scrapers/ambitionbox';
import { synthesizeCulture } from '@/lib/ai/culture';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_COMPANIES_PER_RUN = 30;
const REFRESH_INTERVAL_HOURS = 24;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const results = {};

  // Get distinct company_domains from active jobs
  const { data: domainRows } = await supabase
    .from('jobs')
    .select('company, company_domain')
    .eq('is_active', true)
    .not('company_domain', 'is', null)
    .order('last_seen_at', { ascending: false })
    .limit(200);

  if (!domainRows?.length) {
    return NextResponse.json({ message: 'No active job domains found', duration_ms: Date.now() - startedAt });
  }

  // Deduplicate domains
  const domainMap = new Map();
  for (const row of domainRows) {
    if (row.company_domain && !domainMap.has(row.company_domain)) {
      domainMap.set(row.company_domain, row.company);
    }
  }

  // Get existing intelligence records to check refresh timestamps
  const domains = Array.from(domainMap.keys());
  const { data: existing } = await supabase
    .from('job_intelligence')
    .select('company_domain, refreshed_at')
    .in('company_domain', domains);

  const refreshedAt = new Map((existing || []).map((r) => [r.company_domain, new Date(r.refreshed_at)]));
  const cutoff = new Date(Date.now() - REFRESH_INTERVAL_HOURS * 60 * 60 * 1000);

  // Filter to domains that need refresh
  const toRefresh = Array.from(domainMap.entries())
    .filter(([domain]) => {
      const last = refreshedAt.get(domain);
      return !last || last < cutoff;
    })
    .slice(0, MAX_COMPANIES_PER_RUN);

  if (!toRefresh.length) {
    return NextResponse.json({ message: 'All companies up to date', duration_ms: Date.now() - startedAt });
  }

  for (const [domain, companyName] of toRefresh) {
    try {
      // Compute hiring velocity (jobs posted in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: velocity } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('company_domain', domain)
        .eq('is_active', true)
        .gte('first_seen_at', thirtyDaysAgo);

      // Scrape Glassdoor + AmbitionBox in parallel (both non-throwing)
      const [glassdoor, ambitionbox] = await Promise.all([
        scrapeGlassdoor(companyName, domain),
        scrapeAmbitionBox(companyName),
      ]);

      // Synthesize culture read (returns empty if no data)
      let synthesis;
      try {
        synthesis = await synthesizeCulture(companyName, glassdoor, ambitionbox);
      } catch (err) {
        console.warn(`[culture-refresh] synthesis failed for ${domain}: ${err.message}`);
        synthesis = { culture_summary: null, top_positives: [], top_warnings: [], interview_process: null, common_complaints: null };
      }

      // Build upsert payload
      const payload = {
        company_domain: domain,
        hiring_velocity_30d: velocity || 0,
        refreshed_at: new Date().toISOString(),

        // Glassdoor
        glassdoor_rating: glassdoor?.rating ?? null,
        glassdoor_recommend_pct: glassdoor?.recommend_pct ?? null,
        glassdoor_ceo_approval: glassdoor?.ceo_approval ?? null,
        glassdoor_wlb_score: glassdoor?.wlb_score ?? null,
        glassdoor_culture_score: glassdoor?.culture_score ?? null,

        // AmbitionBox
        ambitionbox_rating: ambitionbox?.rating ?? null,
        ambitionbox_wlb_score: ambitionbox?.wlb_score ?? null,
        ambitionbox_growth_score: ambitionbox?.growth_score ?? null,
        ambitionbox_recommend_pct: ambitionbox?.recommend_pct ?? null,

        // Claude synthesis
        ...synthesis,
      };

      const { error } = await supabase
        .from('job_intelligence')
        .upsert(payload, { onConflict: 'company_domain' });

      if (error) throw new Error(error.message);

      results[domain] = {
        velocity,
        glassdoor: !!glassdoor,
        ambitionbox: !!ambitionbox,
        synthesized: !!(glassdoor || ambitionbox),
      };

      // Polite delay between companies
      await sleep(500);
    } catch (err) {
      console.error(`[culture-refresh] ${domain}: ${err.message}`);
      results[domain] = { error: err.message };
    }
  }

  const successful = Object.values(results).filter((r) => !r.error).length;
  console.log(`[culture-refresh] done — ${successful}/${toRefresh.length} companies refreshed in ${Date.now() - startedAt}ms`);

  return NextResponse.json({
    duration_ms: Date.now() - startedAt,
    companies_processed: toRefresh.length,
    successful,
    results,
  });
}
