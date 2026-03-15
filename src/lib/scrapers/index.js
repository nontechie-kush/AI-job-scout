/**
 * Scraper Registry — Phase 2
 *
 * Orchestrates all job scrapers with circuit breaker.
 * Shared utilities: stripHtml, detectRemote, makeDescHash, upsertJob.
 *
 * Each scraper exports: scrape<Source>() → NormalizedJob[]
 * NormalizedJob shape: { source, external_id, title, company, company_domain,
 *   description, requirements, location, remote_type, apply_url, apply_type,
 *   department, company_stage, posted_at, salary_min, salary_max, salary_currency,
 *   description_hash }
 */

import crypto from 'crypto';
import { withCircuitBreaker } from '@/lib/circuit-breaker';

// ── Shared utilities (imported by all scrapers) ───────────────

export function stripHtml(html = '') {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectRemote(str = '') {
  const s = str.toLowerCase();
  if (s.includes('hybrid')) return 'hybrid';
  if (s.includes('remote') && !s.includes('no remote')) return 'remote';
  if (s.includes('onsite') || s.includes('on-site') || s.includes('in-office') || s.includes('in person')) return 'onsite';
  return 'onsite';
}

export function makeDescHash(company, title, descStart = '') {
  const key = `${(company || '').toLowerCase().trim()}::${(title || '').toLowerCase().trim()}::${(descStart || '').slice(0, 200)}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

export function parseSalary(str = '') {
  if (!str) return { salary_min: null, salary_max: null, salary_currency: 'INR' };
  const currency =
    str.includes('$') || str.toLowerCase().includes('usd')
      ? 'USD'
      : str.includes('£') || str.toLowerCase().includes('gbp')
        ? 'GBP'
        : 'INR';
  const nums = str
    .replace(/[₹$£,]/g, '')
    .match(/\d[\d.]+/g)
    ?.map((n) => Math.round(parseFloat(n) * (n.includes('.') ? 1000 : 1)))
    .filter((n) => n > 0);
  return {
    salary_min: nums?.[0] ?? null,
    salary_max: nums?.[1] ?? nums?.[0] ?? null,
    salary_currency: currency,
  };
}

// ── Job upsert with repost detection ─────────────────────────

export async function upsertJob(supabase, job) {
  const { data: existing } = await supabase
    .from('jobs')
    .select('id, repost_count, posted_at')
    .eq('source', job.source)
    .eq('external_id', job.external_id)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const update = { last_seen_at: now, repost_count: (existing.repost_count || 0) + 1, is_active: true };
    // Backfill posted_at if it was previously null and we now have a value
    if (!existing.posted_at && job.posted_at) update.posted_at = job.posted_at;
    await supabase.from('jobs').update(update).eq('id', existing.id);
    return 'updated';
  }

  const { error } = await supabase.from('jobs').insert({
    ...job,
    first_seen_at: now,
    last_seen_at: now,
    repost_count: 0,
    is_active: true,
  });

  if (error?.code === '23505') {
    // Race — another scraper inserted concurrently
    await supabase
      .from('jobs')
      .update({ last_seen_at: now, is_active: true })
      .eq('source', job.source)
      .eq('external_id', job.external_id);
    return 'updated';
  }

  if (error) throw new Error(`insert failed: ${error.message}`);
  return 'inserted';
}

export async function upsertJobs(supabase, jobs) {
  let inserted = 0,
    updated = 0,
    errors = 0;
  for (const job of jobs) {
    try {
      const result = await upsertJob(supabase, job);
      if (result === 'inserted') inserted++;
      else updated++;
    } catch (err) {
      console.error(`[scraper] upsert error for ${job.source}/${job.external_id}:`, err.message);
      errors++;
    }
  }
  return { inserted, updated, errors };
}

// ── Scraper registry ──────────────────────────────────────────

import { scrapeGreenhouse } from './greenhouse';
import { scrapeLever } from './lever';
import { scrapeAshby } from './ashby';
import { scrapeRemotive } from './remotive';
import { scrapeCutshort } from './cutshort';
import { scrapeWellfound } from './wellfound';
import { scrapeNaukri } from './naukri';
import { scrapeIIMJobs } from './iimjobs';
import { scrapeInstahyre } from './instahyre';

// Sources that consume ScraperAPI credits — skipped automatically when credits are low
const SCRAPERAPI_SOURCES = new Set(['naukri', 'iimjobs', 'instahyre', 'ashby']);

export const SCRAPERS = [
  { source: 'greenhouse', fn: scrapeGreenhouse },
  { source: 'lever', fn: scrapeLever },
  { source: 'ashby', fn: scrapeAshby },   // ScraperAPI renders Ashby SPA
  { source: 'remotive', fn: scrapeRemotive },
  { source: 'cutshort', fn: scrapeCutshort },
  { source: 'wellfound', fn: scrapeWellfound },
  { source: 'naukri', fn: scrapeNaukri },
  { source: 'iimjobs', fn: scrapeIIMJobs },
  { source: 'instahyre', fn: scrapeInstahyre },
  // arc, yc, nextleap, topstartups: dropped — async-loaded SPAs with no public API
  // foundit, hirect: dropped — ScraperAPI HTTP 500 (proxy IPs blocked by these sites)
];

/**
 * Run all scrapers in parallel with circuit breaker + upsert.
 * Returns aggregate stats per source.
 *
 * Pre-flight: checks ScraperAPI credits before starting — skips all
 * ScraperAPI-dependent sources if fewer than 100 credits remain, so
 * we never waste credits on a doomed run.
 *
 * Parallel execution: all scrapers start simultaneously. Each is capped
 * at 5 minutes by the circuit breaker timeout. Total wall-clock time ≈
 * slowest single scraper (~5 min) instead of sum of all (~75 min).
 */
export async function runAllScrapers(supabase) {
  const results = {};

  // ── Pre-flight: ScraperAPI credit check ──────────────────────────────────
  let scraperApiOk = false;
  const scraperKey = process.env.SCRAPERAPI_KEY;
  if (scraperKey && scraperKey !== 'placeholder') {
    try {
      const res = await fetch(
        `https://api.scraperapi.com/account?api_key=${scraperKey}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (res.ok) {
        const { requestCount, requestLimit } = await res.json();
        const remaining = requestLimit - requestCount;
        if (remaining < 100) {
          console.warn(`[scraper] ScraperAPI low: ${remaining} credits left — skipping ScraperAPI sources`);
        } else {
          console.log(`[scraper] ScraperAPI OK: ${remaining} credits remaining (${requestCount}/${requestLimit} used)`);
          scraperApiOk = true;
        }
      }
    } catch (err) {
      console.warn('[scraper] ScraperAPI preflight failed:', err.message, '— skipping ScraperAPI sources');
    }
  }

  // ── Fetch active users for Naukri clusters ────────────────────────────────
  let activeUsers = [];
  try {
    const { data } = await supabase
      .from('users')
      .select('target_roles, locations, remote_pref, profiles(parsed_json)')
      .eq('onboarding_completed', true)
      .limit(200);
    activeUsers = data || [];
    console.log(`[scraper] ${activeUsers.length} active users → Naukri clusters`);
  } catch (err) {
    console.warn('[scraper] could not fetch users for Naukri — using default clusters:', err.message);
  }

  // ── Run all scrapers in parallel ──────────────────────────────────────────
  await Promise.allSettled(
    SCRAPERS.map(async ({ source, fn }) => {
      // Skip ScraperAPI-dependent sources if credits are exhausted
      if (SCRAPERAPI_SOURCES.has(source) && !scraperApiOk) {
        results[source] = { skipped: true, reason: 'scraperapi_credits_exhausted' };
        return;
      }

      const wrappedFn = source === 'naukri' ? () => fn(activeUsers) : fn;

      try {
        const cbResult = await withCircuitBreaker(source, wrappedFn);

        if (cbResult?.skipped) {
          results[source] = { skipped: true, reason: cbResult.reason };
          return;
        }
        if (cbResult?.error) {
          results[source] = { error: cbResult.error, failures: cbResult.failures };
          return;
        }

        const jobs = Array.isArray(cbResult) ? cbResult : [];
        const stats = await upsertJobs(supabase, jobs);
        results[source] = { scraped: jobs.length, ...stats };
      } catch (err) {
        results[source] = { error: err.message };
      }
    }),
  );

  return results;
}
