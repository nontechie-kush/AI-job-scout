/**
 * Cutshort.io scraper — uses __NEXT_DATA__ from category pages
 *
 * Cutshort is India's leading startup job board (~3000 active jobs).
 * Category pages are fully server-rendered — no ScraperAPI needed.
 * Each category returns up to 50 jobs in __NEXT_DATA__.
 *
 * Strategy: scrape a fixed set of India startup-relevant categories.
 * The matching engine handles role relevance — we just need the raw jobs.
 */

import { stripHtml, makeDescHash, detectRemote } from './index';

const BASE  = 'https://cutshort.io';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Verified slugs — these return 4-50 jobs each (checked March 2026)
const CATEGORIES = [
  'product-management-jobs',
  'product-manager-jobs',
  'growth-hacking-jobs',
  'marketing-jobs',
  'marketing-sales-jobs',
  'digital-marketing-jobs',
  'business-development-jobs',
  'operations-jobs',
  'sales-jobs',
  'general-management-jobs',
];

// Cutshort stage labels → schema values
const STAGE_MAP = {
  'seed':         'seed',
  'series a':     'series_a',
  'series b':     'series_b',
  'series c':     'series_c',
  'growth':       'growth',
  'public':       'public',
  'bootstrapped': null,
  'acquired':     null,
};

// ── Main export ────────────────────────────────────────────────────────────────

export async function scrapeCutshort() {
  const seen = new Set();
  const all  = [];

  for (const category of CATEGORIES) {
    try {
      const jobs = await fetchCategory(category);
      for (const job of jobs) {
        if (!seen.has(job.description_hash)) {
          seen.add(job.description_hash);
          all.push(job);
        }
      }
      await sleep(700); // polite delay
    } catch (err) {
      console.warn(`[cutshort] ${category} failed:`, err.message);
    }
  }

  console.log(`[cutshort] scraped ${all.length} unique jobs across ${CATEGORIES.length} categories`);
  return all;
}

// ── Category page fetch ────────────────────────────────────────────────────────

async function fetchCategory(slug) {
  const res = await fetch(`${BASE}/jobs/${slug}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':     'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html  = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
  if (!match) throw new Error('No __NEXT_DATA__ found');

  const d       = JSON.parse(match[1]);
  const queries = d.props?.pageProps?.dehydratedState?.queries || [];

  for (const q of queries) {
    const jobs = q.state?.data?.data?.pageData?.jobs;
    if (Array.isArray(jobs) && jobs.length > 0) {
      return jobs.map(parseJob).filter(Boolean);
    }
  }

  return [];
}

// ── Job normaliser ─────────────────────────────────────────────────────────────

function parseJob(j) {
  try {
    const title   = (j.headline || '').trim();
    const company = (j.companyDetails?.name || '').trim();
    if (!title || !company) return null;

    const descHtml  = j.sanitizedComment || '';
    const descText  = stripHtml(descHtml).slice(0, 3000);
    const location  = j.locationsText || j.locations?.[0] || 'India';
    const isRemote  = j.remoteType === 'remote_okay' || j.remoteType === 'full_remote'
                      || detectRemote(location + ' ' + descText);

    // Salary — Cutshort stores raw INR (not LPA). Divide by 100000 → LPA.
    const sr     = j.salaryRange || {};
    const salMin = sr.min ? Math.round(sr.min / 100000) : null;
    const salMax = sr.max ? Math.round(sr.max / 100000) : null;
    // Sanity check — reject clearly wrong values (< ₹1L or > ₹500L)
    const salMinClean = salMin && salMin >= 1 && salMin <= 500 ? salMin : null;
    const salMaxClean = salMax && salMax >= 1 && salMax <= 500 ? salMax : null;

    const rawStage  = (j.companyDetails?.stage || '').toLowerCase();
    const compStage = STAGE_MAP[rawStage] ?? null;

    // Domain from website — best-effort, non-fatal
    let domain = null;
    try {
      const website = j.companyDetails?.links?.website || '';
      if (website) domain = new URL(website).hostname.replace(/^www\./, '');
    } catch { /* skip */ }

    return {
      source:           'cutshort',
      external_id:      j._id,
      title,
      company,
      company_domain:   domain,
      description:      descText,
      requirements:     [],
      location,
      remote_type:      isRemote ? 'remote' : 'onsite',
      apply_url:        j.publicUrl || `${BASE}/job/${j._id}`,
      apply_type:       'cutshort',
      department:       null,
      company_stage:    compStage,
      posted_at:        null,
      salary_min:       salMinClean,
      salary_max:       salMaxClean,
      salary_currency:  sr.currency || 'INR',
      is_active:        true,
      description_hash: makeDescHash(title + company + (j.sanitizedComment || '').slice(0, 500)),
    };
  } catch {
    return null;
  }
}
