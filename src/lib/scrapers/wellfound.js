/**
 * Wellfound (formerly AngelList Talent) scraper
 * Startup-focused job board. Uses ScraperAPI for JS rendering.
 * Falls back to HTML parsing if no ScraperAPI key.
 */

import { load } from 'cheerio';
import { stripHtml, detectRemote, makeDescHash, parseSalary } from './index';

const BASE = 'https://wellfound.com';
const SEARCH_URLS = [
  `${BASE}/jobs/product-manager`,
  `${BASE}/jobs/software-engineer`,
  `${BASE}/jobs/engineering-manager`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeWellfound() {
  const scraperKey = process.env.SCRAPERAPI_KEY;
  const jobs = [];
  const seen = new Set();

  for (const searchUrl of SEARCH_URLS) {
    try {
      const fetchUrl = scraperKey
        ? `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchUrl)}&render=true`
        : searchUrl;

      const res = await fetch(fetchUrl, {
        headers: scraperKey ? {} : {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) { console.warn(`[wellfound] ${searchUrl}: HTTP ${res.status}`); continue; }

      const html = await res.text();
      const $ = load(html);

      // Try Next.js data
      const nextDataRaw = $('#__NEXT_DATA__').text();
      if (nextDataRaw) {
        try {
          const nextData = JSON.parse(nextDataRaw);
          const parsed = extractWellfoundNextData(nextData);
          parsed.forEach((j) => { if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); } });
          await sleep(1000);
          continue;
        } catch { /* fall through */ }
      }

      // HTML fallback
      const parsed = extractWellfoundHTML($);
      parsed.forEach((j) => { if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); } });
      await sleep(1000);
    } catch (err) {
      console.warn(`[wellfound] ${searchUrl}: ${err.message}`);
    }
  }

  if (jobs.length === 0 && !scraperKey) {
    console.warn('[wellfound] No jobs found — consider setting SCRAPERAPI_KEY for JS rendering');
  }

  console.log(`[wellfound] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractWellfoundNextData(nextData) {
  const jobs = [];
  const startups = nextData?.props?.pageProps?.startups || nextData?.props?.pageProps?.jobListings || [];

  for (const startup of startups) {
    const company = startup.name || startup.companyName || 'Unknown';
    const companyDomain = startup.website ? extractDomain(startup.website) : null;
    const roles = startup.jobListings || startup.jobs || (startup.title ? [startup] : []);

    for (const job of roles) {
      const title = job.title || job.jobTitle;
      if (!title) continue;

      const location = job.locationNames?.join(', ') || job.location || 'Remote';
      const desc = stripHtml(job.description || '');
      const salary = parseSalary(job.compensation || '');

      jobs.push({
        source: 'wellfound',
        external_id: String(job.id || job.slug || `${company}-${title}`),
        title,
        company,
        company_domain: companyDomain || `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        description: desc.slice(0, 8000),
        requirements: [],
        location,
        remote_type: detectRemote(location + (job.remote ? ' remote' : '')),
        apply_url: job.slug ? `${BASE}/jobs/${job.slug}` : `${BASE}/company/${startup.slug}/jobs`,
        apply_type: 'external',
        department: null,
        company_stage: inferStage(startup.stage || startup.fundingStage),
        posted_at: null,
        ...salary,
        description_hash: makeDescHash(company, title, desc),
      });
    }
  }

  return jobs;
}

function extractWellfoundHTML($) {
  const jobs = [];

  $('[class*="job-listing"], [data-test="job-listing"], [class*="JobListing"]').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="title"], h2, h3').first().text().trim();
    const company = $el.find('[class*="company-name"], [class*="startup-name"]').first().text().trim();
    if (!title || !company) return;

    const location = $el.find('[class*="location"]').first().text().trim() || 'Remote';
    const href = $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const desc = stripHtml($el.text());

    jobs.push({
      source: 'wellfound',
      external_id: url,
      title,
      company,
      company_domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: desc.slice(0, 2000),
      requirements: [],
      location,
      remote_type: detectRemote(location),
      apply_url: url,
      apply_type: 'external',
      department: null,
      company_stage: 'unknown',
      posted_at: null,
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      description_hash: makeDescHash(company, title, desc),
    });
  });

  return jobs;
}

function inferStage(stage = '') {
  const s = stage.toLowerCase();
  if (s.includes('seed') || s.includes('pre')) return 'seed';
  if (s.includes('series a') || s.includes('series_a')) return 'series_a';
  if (s.includes('series b') || s.includes('series_b')) return 'series_b';
  if (s.includes('series c') || s.includes('growth')) return 'growth';
  if (s.includes('public') || s.includes('ipo')) return 'public';
  return 'unknown';
}

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
