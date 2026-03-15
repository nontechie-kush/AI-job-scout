/**
 * Foundit.in scraper (formerly Monster India + Quikr Jobs)
 *
 * India's largest job board — millions of listings including senior roles
 * not on Naukri or Cutshort. Strong in BFSI, FMCG, ops, strategy, leadership.
 *
 * API approach: Foundit exposes a public JSON search API used by their own site.
 * Endpoint: GET https://www.foundit.in/middleware/jobsearch/v2/jobs
 * Params: query, location, page, limit (no auth required)
 *
 * Requires SCRAPERAPI_KEY for header spoofing (Foundit checks referer/origin).
 * Falls back to direct fetch; skips gracefully if key missing.
 */

import { load } from 'cheerio';
import { detectRemote, makeDescHash, parseSalary, stripHtml } from './index';

const BASE       = 'https://www.foundit.in';
const API_BASE   = `${BASE}/middleware/jobsearch/v2/jobs`;
const sleep      = (ms) => new Promise((r) => setTimeout(r, ms));

// Search clusters — role × location combinations
const CLUSTERS = [
  { query: 'product manager',     location: 'india' },
  { query: 'growth manager',      location: 'india' },
  { query: 'engineering manager', location: 'india' },
  { query: 'software engineer',   location: 'bangalore' },
  { query: 'business development',location: 'india' },
  { query: 'product manager',     location: 'bangalore' },
  { query: 'strategy manager',    location: 'india' },
];

export async function scrapeFoundit() {
  const scraperKey = process.env.SCRAPERAPI_KEY;
  const seen = new Set();
  const all  = [];

  for (const { query, location } of CLUSTERS) {
    try {
      const jobs = await fetchCluster(query, location, scraperKey);
      for (const job of jobs) {
        if (!seen.has(job.description_hash)) {
          seen.add(job.description_hash);
          all.push(job);
        }
      }
      await sleep(1000);
    } catch (err) {
      console.warn(`[foundit] ${query}/${location}: ${err.message}`);
    }
  }

  console.log(`[foundit] scraped ${all.length} unique jobs`);
  return all;
}

async function fetchCluster(query, location, scraperKey) {
  // Try JSON API first (fast, structured)
  const apiUrl = `${API_BASE}?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=30&page=0`;

  const headers = {
    'User-Agent':  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer':     `${BASE}/srp/results`,
    'Origin':      BASE,
    'Accept':      'application/json, text/plain, */*',
    'x-requested-with': 'XMLHttpRequest',
  };

  try {
    // Direct JSON API attempt — works without ScraperAPI ~60% of time
    const res = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const data = await res.json();
        const listings = data?.jobSearchResponse?.data?.jobList
          || data?.data?.jobList
          || data?.jobList
          || [];
        if (listings.length > 0) return listings.map(parseFounditJob).filter(Boolean);
      }
    }
  } catch { /* fall through to ScraperAPI */ }

  // Fallback: ScraperAPI render=true on search results page
  if (!scraperKey || scraperKey === 'placeholder') {
    console.log(`[foundit] no SCRAPERAPI_KEY, direct API failed for ${query}`);
    return [];
  }

  const searchPage = `${BASE}/srp/results?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`;
  const proxyUrl   = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchPage)}&render=true&country_code=in&wait=2000`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);

  const html = await res.text();
  const $    = load(html);

  // Try __NEXT_DATA__ from rendered page
  const nextData = $('#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const d = JSON.parse(nextData);
      const listings =
        d?.props?.pageProps?.initialData?.jobList ||
        d?.props?.pageProps?.jobs ||
        d?.props?.pageProps?.data?.jobList ||
        [];
      if (listings.length > 0) return listings.map(parseFounditJob).filter(Boolean);
    } catch { /* fall through to HTML */ }
  }

  // HTML fallback
  return extractFounditHTML($);
}

// ── JSON parser ──────────────────────────────────────────────────────────────

function parseFounditJob(j) {
  try {
    const title   = (j.jobTitle || j.title || '').trim();
    const company = (j.company?.name || j.companyName || j.company || '').trim();
    if (!title || !company) return null;

    const location   = j.location || j.city || j.jobLocation || 'India';
    const salaryText = j.salary || j.ctc || j.salaryLabel || '';
    const salary     = parseSalary(salaryText);
    const desc       = stripHtml(j.jobDescription || j.description || `${title} at ${company} in ${location}`).slice(0, 3000);
    const jobId      = String(j.jobId || j.id || `${company}-${title}`);
    const applyUrl   = j.applyUrl || j.jobUrl || `${BASE}/srp/jobs/${jobId}`;
    const isRemote   = j.workFromHome || j.remote || false;

    return {
      source:           'foundit',
      external_id:      jobId,
      title,
      company,
      company_domain:   extractDomain(j.company?.website) || `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description:      desc,
      requirements:     Array.isArray(j.skills) ? j.skills : [],
      location,
      remote_type:      detectRemote(location + (isRemote ? ' remote' : '')),
      apply_url:        applyUrl,
      apply_type:       'external',
      department:       j.department || j.functionalArea || null,
      company_stage:    null,
      posted_at:        j.postedDate || j.createdDate || null,
      ...salary,
      description_hash: makeDescHash(company, title, desc),
      is_active:        true,
    };
  } catch { return null; }
}

// ── HTML fallback ────────────────────────────────────────────────────────────

function extractFounditHTML($) {
  const jobs = [];

  $('[class*="cardContainer"], [class*="job-card"], [class*="jobCard"], [data-job-id]').each((_, el) => {
    const $el = $(el);
    const title   = $el.find('[class*="jobTitle"], [class*="job-title"], h3, h2').first().text().trim();
    const company = $el.find('[class*="companyName"], [class*="company-name"]').first().text().trim();
    if (!title || !company) return;

    const location   = $el.find('[class*="location"], [class*="Location"]').first().text().trim() || 'India';
    const salaryText = $el.find('[class*="salary"], [class*="Salary"]').first().text().trim();
    const href       = $el.find('a').first().attr('href');
    if (!href) return;

    const url    = href.startsWith('http') ? href : `${BASE}${href}`;
    const salary = parseSalary(salaryText);
    const desc   = `${title} at ${company} — ${location}`;

    jobs.push({
      source:           'foundit',
      external_id:      url,
      title,
      company,
      company_domain:   `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description:      desc,
      requirements:     [],
      location,
      remote_type:      detectRemote(location),
      apply_url:        url,
      apply_type:       'external',
      department:       null,
      company_stage:    null,
      posted_at:        null,
      ...salary,
      description_hash: makeDescHash(company, title, desc),
      is_active:        true,
    });
  });

  return jobs;
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}
