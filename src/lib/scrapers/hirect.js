/**
 * Hirect scraper — India startup hiring platform
 * Uses ScraperAPI if SCRAPERAPI_KEY is set (JS-rendered SPA).
 * Falls back to direct fetch (may get empty results for SPA pages).
 */

import { load } from 'cheerio';
import { detectRemote, makeDescHash, parseSalary } from './index';

const BASE = 'https://hirect.in';
const SEARCH_URL = `${BASE}/jobs`;

export async function scrapeHirect() {
  const scraperKey = process.env.SCRAPERAPI_KEY;

  const fetchUrl = scraperKey
    ? `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(SEARCH_URL)}&render=true`
    : SEARCH_URL;

  const res = await fetch(fetchUrl, {
    headers: scraperKey ? {} : {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = load(html);
  const jobs = extractHirectJobs($);

  if (jobs.length === 0 && !scraperKey) {
    console.warn('[hirect] No jobs found — Hirect is a SPA, consider setting SCRAPERAPI_KEY');
  }

  console.log(`[hirect] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractHirectJobs($) {
  const jobs = [];

  $('[class*="job"], [class*="card"], [data-job]').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="title"], h2, h3').first().text().trim();
    const company = $el.find('[class*="company"], [class*="employer"]').first().text().trim();
    if (!title || !company) return;

    const location = $el.find('[class*="location"]').first().text().trim() || 'India';
    const salaryText = $el.find('[class*="salary"], [class*="ctc"]').first().text().trim();
    const href = $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const salary = parseSalary(salaryText);

    jobs.push({
      source: 'hirect',
      external_id: url,
      title,
      company,
      company_domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: `${title} at ${company} in ${location}`,
      requirements: [],
      location,
      remote_type: detectRemote(location),
      apply_url: url,
      apply_type: 'external',
      department: null,
      company_stage: 'unknown',
      posted_at: null,
      ...salary,
      description_hash: makeDescHash(company, title, location),
    });
  });

  return jobs;
}
