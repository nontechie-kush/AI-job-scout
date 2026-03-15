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

// Maps signal words in user target_role → plain-text Instahyre search keyword
// Instahyre uses free-text search (?keyword=...), not URL slugs like Naukri
const ROLE_KEYWORD_MAP = [
  { match: /product\s*manager|pm\b|head\s+of\s+product/i,       keyword: 'product manager' },
  { match: /product\s*analyst/i,                                  keyword: 'product analyst' },
  { match: /program\s*manager/i,                                  keyword: 'program manager' },
  { match: /growth\s*manager|growth\s*lead/i,                     keyword: 'growth manager' },
  { match: /engineering\s*manager/i,                              keyword: 'engineering manager' },
  { match: /tech(nical)?\s*lead/i,                                keyword: 'tech lead' },
  { match: /react\s*native/i,                                     keyword: 'react native developer' },
  { match: /react(\.?js)?/i,                                      keyword: 'react developer' },
  { match: /node(\.?js)?/i,                                       keyword: 'node.js developer' },
  { match: /python/i,                                             keyword: 'python developer' },
  { match: /java\b(?!script)/i,                                   keyword: 'java developer' },
  { match: /android/i,                                            keyword: 'android developer' },
  { match: /ios/i,                                                keyword: 'ios developer' },
  { match: /flutter/i,                                            keyword: 'flutter developer' },
  { match: /devops/i,                                             keyword: 'devops engineer' },
  { match: /data\s*engineer/i,                                    keyword: 'data engineer' },
  { match: /data\s*scientist/i,                                   keyword: 'data scientist' },
  { match: /machine\s*learning|ml\s*engineer/i,                   keyword: 'machine learning engineer' },
  { match: /frontend|front[\s-]end/i,                             keyword: 'frontend developer' },
  { match: /backend|back[\s-]end/i,                               keyword: 'backend engineer' },
  { match: /full[\s-]?stack/i,                                    keyword: 'full stack developer' },
  { match: /software\s*(engineer|developer)|sde\b|swe\b/i,        keyword: 'software engineer' },
  { match: /business\s*development/i,                             keyword: 'business development' },
  { match: /sales\s*manager/i,                                    keyword: 'sales manager' },
  { match: /ui[\s/]?ux|product\s*design/i,                        keyword: 'ui ux designer' },
];

const LOCATION_MAP = {
  bangalore: 'bangalore', bengaluru: 'bangalore',
  mumbai: 'mumbai', delhi: 'delhi', 'delhi ncr': 'delhi',
  hyderabad: 'hyderabad', pune: 'pune', chennai: 'chennai',
  india: '',  // empty = all-India search on Instahyre
};

function buildSearchURLs(users, maxURLs = 30) {
  if (!users?.length) return DEFAULT_URLS;

  const seen = new Set();
  const urls = [];

  for (const user of users) {
    if (urls.length >= maxURLs) break;
    const roles = (user.target_roles || []).slice(0, 3);
    const rawLocs = user.locations || [];
    const hasIndia = rawLocs.some((l) => l.toLowerCase() === 'india');
    const locations = hasIndia
      ? ['']  // empty = all-India
      : [...new Set(rawLocs.map((l) => LOCATION_MAP[l.toLowerCase()]).filter((l) => l != null))].slice(0, 2);
    if (!locations.length) continue;

    for (const role of roles) {
      const entry = ROLE_KEYWORD_MAP.find(({ match }) => match.test(role));
      const keyword = entry?.keyword || 'software engineer';

      for (const loc of locations) {
        const url = loc
          ? `${BASE}/search-jobs/?keyword=${encodeURIComponent(keyword)}&location=${loc}`
          : `${BASE}/search-jobs/?keyword=${encodeURIComponent(keyword)}`;
        if (!seen.has(url) && urls.length < maxURLs) { seen.add(url); urls.push(url); }
      }
    }
  }

  const final = urls.length > 0 ? urls : DEFAULT_URLS;
  console.log(`[instahyre] ${final.length} search URLs: ${final.map(u => u.replace(BASE, '')).join(' | ')}`);
  return final;
}

// Fallback when no users available
const DEFAULT_URLS = [
  `${BASE}/search-jobs/?keyword=product+manager&location=bangalore`,
  `${BASE}/search-jobs/?keyword=software+engineer&location=bangalore`,
  `${BASE}/search-jobs/?keyword=engineering+manager&location=bangalore`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeInstahyre(users = []) {
  const scraperKey = process.env.SCRAPERAPI_KEY;
  if (!scraperKey || scraperKey === 'placeholder') {
    console.log('[instahyre] no SCRAPERAPI_KEY — skipping');
    return [];
  }

  const searchURLs = buildSearchURLs(users);
  const jobs = [];
  const seen = new Set();

  for (const searchUrl of searchURLs) {
    try {
      const fetchUrl = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchUrl)}&render=true&country_code=in`;

      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(90000) });
      if (!res.ok) { console.warn(`[instahyre] HTTP ${res.status} for ${searchUrl}`); continue; }

      const html = await res.text();
      const $ = load(html);

      const pageJobs = extractInstahyreNextData($, html) || extractInstahyreHTML($);

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

function extractInstahyreNextData($, html) {
  try {
    const raw = $('#__NEXT_DATA__').text();
    if (!raw) return null;

    const data = JSON.parse(raw);
    const pp = data?.props?.pageProps;

    // Walk all known paths — Instahyre's structure shifts between deploys
    const jobs =
      pp?.jobs ||
      pp?.jobList ||
      pp?.initialData?.jobs ||
      pp?.data?.jobs ||
      pp?.searchResults?.jobs ||
      pp?.results ||
      [];

    if (!jobs.length) {
      // Last resort: regex scan raw HTML for embedded JSON job arrays
      const m = html?.match(/"jobs"\s*:\s*(\[\{.+?\}\])/s);
      if (m) {
        const parsed = JSON.parse(m[1]);
        if (parsed?.length) return parsed.map(parseInstahyreJob).filter(Boolean);
      }
      return null;
    }
    return jobs.map(parseInstahyreJob).filter(Boolean);
  } catch {
    return null;
  }
}

// ── Extraction: HTML fallback ─────────────────────────────────────────────────

function extractInstahyreHTML($) {
  const jobs = [];

  // Instahyre uses Angular 1.x — cards rendered in ng-repeat as div.employer-block
  // company-name div contains "Company - Job Title" format
  $('div.employer-block').each((_, el) => {
    const $el = $(el);

    // "Nielsen - Data Engineer" — split on first " - "
    const nameText = $el.find('div.company-name').first().text().trim();
    if (!nameText) return;
    const dashIdx  = nameText.indexOf(' - ');
    const company  = dashIdx > 0 ? nameText.slice(0, dashIdx).trim() : nameText;
    const title    = dashIdx > 0 ? nameText.slice(dashIdx + 3).trim() : nameText;
    if (!title) return;

    const location   = $el.find('.employer-locations .info .ng-binding, .employer-locations span').first().text().trim() || 'India';
    const href       = $el.find('a#employer-profile-opportunity').attr('ng-href')
                    || $el.find('a[href*="/job-"]').first().attr('href');
    if (!href) return;

    const url   = href.startsWith('http') ? href : `${BASE}${href}`;
    // URL format: /job-405179-data-engineer-at-nielsen-bangalore/
    const jobId = href.match(/job-(\d+)/)?.[1] || url;
    const desc  = `${title} at ${company} — ${location}`;

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
      apply_type:       'external',
      department:       null,
      company_stage:    null,
      posted_at:        null,
      salary_min:       null,
      salary_max:       null,
      salary_currency:  'INR',
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
    apply_type:       'external',
    department:       raw.department || null,
    company_stage:    null,
    posted_at:        raw.createdAt || raw.postedAt || null,
    ...salary,
    description_hash: makeDescHash(company, title, desc),
  };
}
