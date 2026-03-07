/**
 * Instahyre scraper — India's premium tech hiring platform
 *
 * Instahyre is React-rendered. Without ScraperAPI it typically returns
 * a minimal HTML shell. Requires SCRAPERAPI_KEY + render=true for full content.
 *
 * Search page: https://www.instahyre.com/search-jobs/?keyword=...&location=...
 * Targets: PM, engineering, leadership roles in Indian tech companies.
 */

import { load } from 'cheerio';
import { detectRemote, makeDescHash, parseSalary } from './index';

const BASE = 'https://www.instahyre.com';

const SEARCH_URLS = [
  `${BASE}/search-jobs/?keyword=product+manager&location=bangalore`,
  `${BASE}/search-jobs/?keyword=product+manager&location=mumbai`,
  `${BASE}/search-jobs/?keyword=product+manager&location=delhi`,
  `${BASE}/search-jobs/?keyword=software+engineer&location=bangalore`,
  `${BASE}/search-jobs/?keyword=engineering+manager&location=bangalore`,
  `${BASE}/search-jobs/?keyword=product+manager`, // remote / all-India
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeInstahyre() {
  const scraperKey = process.env.SCRAPERAPI_KEY;
  if (!scraperKey) {
    throw new Error('SCRAPERAPI_KEY required for Instahyre (React-rendered). Set it to enable this source.');
  }

  const jobs = [];
  const seen = new Set();

  for (const searchUrl of SEARCH_URLS) {
    try {
      const fetchUrl = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchUrl)}&render=true&country_code=in`;

      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.warn(`[instahyre] HTTP ${res.status} for ${searchUrl}`); continue; }

      const html = await res.text();
      const $ = load(html);

      // Try to extract embedded JSON (Next.js __NEXT_DATA__ or window.__data__)
      const pageJobs = extractInstahyreNextData($) || extractInstahyreHTML($);

      pageJobs.forEach((j) => {
        if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); }
      });

      await sleep(2000);
    } catch (err) {
      console.warn(`[instahyre] ${searchUrl}: ${err.message}`);
    }
  }

  console.log(`[instahyre] scraped ${jobs.length} jobs`);
  return jobs;
}

// ── Extraction: embedded JSON ─────────────────────────────────────────────────

function extractInstahyreNextData($) {
  try {
    const raw = $('#__NEXT_DATA__').text();
    if (!raw) return null;

    const data = JSON.parse(raw);
    // Instahyre stores job list at various paths depending on page version
    const jobs =
      data?.props?.pageProps?.jobs ||
      data?.props?.pageProps?.jobList ||
      data?.props?.pageProps?.initialData?.jobs ||
      [];

    if (!jobs.length) return null;
    return jobs.map(parseInstahyreJob).filter(Boolean);
  } catch {
    return null;
  }
}

// ── Extraction: HTML fallback ─────────────────────────────────────────────────

function extractInstahyreHTML($) {
  const jobs = [];

  // Instahyre job card selectors — may change; gracefully returns empty if unmatched
  $('[class*="job-card"], [class*="JobCard"], [class*="job_card"], [data-job-id]').each((_, el) => {
    const $el = $(el);

    const title   = $el.find('[class*="job-title"], [class*="jobTitle"], h2, h3').first().text().trim();
    const company = $el.find('[class*="company-name"], [class*="companyName"]').first().text().trim();
    if (!title || !company) return;

    const location   = $el.find('[class*="location"], [class*="Location"]').first().text().trim() || 'India';
    const salaryText = $el.find('[class*="salary"], [class*="Salary"], [class*="ctc"]').first().text().trim();
    const href       = $el.find('a[href*="/employer/"], a[href*="/job/"]').first().attr('href');
    if (!href) return;

    const url    = href.startsWith('http') ? href : `${BASE}${href}`;
    const jobId  = url.split('/').filter(Boolean).pop() || url;
    const salary = parseSalary(salaryText);
    const desc   = `${title} at ${company} — ${location}`;

    jobs.push({
      source:           'instahyre',
      external_id:      jobId,
      title,
      company,
      company_domain:   `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description:      desc,
      requirements:     [],
      location,
      remote_type:      detectRemote(location),
      apply_url:        url,
      apply_type:       'instahyre',
      department:       null,
      company_stage:    'unknown',
      posted_at:        null,
      ...salary,
      description_hash: makeDescHash(company, title, location),
    });
  });

  return jobs;
}

// ── JSON job parser ───────────────────────────────────────────────────────────

function parseInstahyreJob(raw) {
  const title   = (raw.designation || raw.title || raw.role || '').trim();
  const company = (raw.company?.name || raw.companyName || raw.company || '').trim();
  if (!title || !company) return null;

  const jobId      = String(raw.id || raw.jobId || `${company}-${title}`);
  const slug       = raw.slug || raw.jobSlug || jobId;
  const location   = raw.location || raw.city || 'India';
  const salaryText = raw.salary || raw.ctc || '';
  const salary     = parseSalary(salaryText);
  const url        = raw.url || `${BASE}/employer/${raw.company?.slug || 'job'}/${slug}/`;
  const desc       = (raw.description || `${title} at ${company} — ${location}`).slice(0, 3000);

  return {
    source:           'instahyre',
    external_id:      jobId,
    title,
    company,
    company_domain:   `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    description:      desc,
    requirements:     Array.isArray(raw.skills) ? raw.skills : [],
    location,
    remote_type:      detectRemote(location + (raw.workFromHome ? ' remote' : '')),
    apply_url:        url,
    apply_type:       'instahyre',
    department:       raw.department || null,
    company_stage:    'unknown',
    posted_at:        raw.createdAt || raw.postedAt || null,
    ...salary,
    description_hash: makeDescHash(company, title, desc),
  };
}
