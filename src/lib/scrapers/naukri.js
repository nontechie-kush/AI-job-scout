/**
 * Naukri.com scraper — ScraperAPI + rendered HTML
 *
 * NOTE: The previous approach (internal JSON API /jobapi/v4/jobs with
 * appid:109 headers) is dead as of March 2026 (returns 404).
 *
 * Current approach: ScraperAPI render=true fetches the JS-rendered search
 * results page, then Cheerio parses job cards from the rendered HTML.
 *
 * Requires SCRAPERAPI_KEY env var. If missing or set to "placeholder" → skips.
 *
 * URL format: naukri.com/{keyword}-jobs-in-{location}?experience={min}-{max}&jobAge=1
 */

import { load } from 'cheerio';
import { stripHtml, detectRemote, makeDescHash, parseSalary } from './index';

const SCRAPER_API = 'https://api.scraperapi.com';
const sleep       = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Location mapping ──────────────────────────────────────────────────────────

const LOCATION_MAP = {
  bangalore:   'bangalore',
  bengaluru:   'bangalore',
  mumbai:      'mumbai',
  delhi:       'delhi-ncr',
  'delhi ncr': 'delhi-ncr',
  hyderabad:   'hyderabad',
  pune:        'pune',
  chennai:     'chennai',
  india:       'india',
};

const DEFAULT_CLUSTERS = [
  { keyword: 'product-manager',      location: 'india', expMin: 3, expMax: 8  },
  { keyword: 'growth-manager',       location: 'india', expMin: 4, expMax: 10 },
  { keyword: 'software-engineer',    location: 'bangalore', expMin: 2, expMax: 6 },
  { keyword: 'engineering-manager',  location: 'india', expMin: 5, expMax: 12 },
  { keyword: 'business-development', location: 'india', expMin: 3, expMax: 8  },
];

// ── Experience band ───────────────────────────────────────────────────────────

function getExpBand(yearsExp) {
  const y = parseInt(yearsExp) || 0;
  if (y === 0)  return { expMin: 0, expMax: 2 };
  if (y <= 2)   return { expMin: 1, expMax: 3 };
  if (y <= 5)   return { expMin: 3, expMax: 7 };
  if (y <= 9)   return { expMin: 5, expMax: 11 };
  return         { expMin: 8, expMax: 20 };
}

// Words that indicate seniority/level — not useful as Naukri search keywords
const SENIORITY = new Set(['general', 'senior', 'junior', 'associate', 'staff', 'principal',
  'vp', 'managing', 'global', 'regional', 'group', 'chief', 'deputy', 'assistant', 'head',
  'director', 'officer', 'president', 'executive']);

// Role-type suffix words
const ROLE_TYPES = new Set(['manager', 'engineer', 'developer', 'designer', 'analyst',
  'consultant', 'lead', 'architect', 'scientist', 'specialist']);

const STOP = new Set(['of', 'the', 'and', 'or', 'at', 'in', 'for', 'a', 'an', 'to', 'by']);

/**
 * Extract 1-2 Naukri-friendly search keywords from a verbose role title.
 *
 * "General Manager, Growth (CRM Head)"  → ['growth-manager', 'crm-manager']
 * "Product Manager"                     → ['product-manager']
 * "Senior Software Engineer"            → ['software-engineer']
 * "Business Development Manager"        → ['business-development-manager']
 * "Head of Product"                     → ['product-manager']
 */
function extractNaukriKeywords(roleTitle) {
  const clean = (roleTitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s,()]/g, '')
    .replace(/[()]/g, ',');

  // Detect role type from the whole string (default: manager)
  const allWords = clean.replace(/,/g, ' ').split(/\s+/);
  const roleType = allWords.find((w) => ROLE_TYPES.has(w)) || 'manager';

  // Each comma/paren-delimited chunk can yield one keyword
  const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
  const keywords = [];

  for (const part of parts) {
    const words = part.split(/\s+/).filter((w) => w.length >= 3);
    const funcWords = words.filter(
      (w) => !SENIORITY.has(w) && !STOP.has(w) && !ROLE_TYPES.has(w)
    );
    if (!funcWords.length) continue;

    // Up to 2 function words + role type → "growth-manager", "business-development-manager"
    const kw = `${funcWords.slice(0, 2).join('-')}-${roleType}`;
    if (!keywords.includes(kw)) keywords.push(kw);
  }

  return keywords.length > 0 ? keywords.slice(0, 2) : [`${roleType}`];
}

// ── Search cluster builder ────────────────────────────────────────────────────

export function buildSearchClusters(users, maxClusters = 25) {
  if (!users?.length) return DEFAULT_CLUSTERS;

  const seen     = new Set();
  const clusters = [];

  for (const user of users) {
    if (clusters.length >= maxClusters) break;

    const roles    = (user.target_roles || []).slice(0, 3);
    const rawLocs  = user.locations || [];
    const yearsExp = user.profiles?.[0]?.parsed_json?.years_exp ?? null;
    const { expMin, expMax } = getExpBand(yearsExp);

    // If user selected India → single pan-India cluster (covers all cities)
    const hasIndia = rawLocs.some((l) => l.toLowerCase() === 'india');
    let locations;
    if (hasIndia) {
      locations = ['india'];
    } else {
      locations = [...new Set(
        rawLocs.map((l) => LOCATION_MAP[l.toLowerCase()]).filter(Boolean)
      )].slice(0, 2);
    }
    if (!locations.length) locations = ['india'];

    // Keywords from explicit target_roles only — never from CV
    const keywords = [...new Set(roles.flatMap(extractNaukriKeywords).filter(Boolean))];
    if (!keywords.length) continue;

    for (const keyword of keywords) {
      for (const location of locations) {
        const key = `${keyword}::${location}::${expMin}-${expMax}`;
        if (!seen.has(key) && clusters.length < maxClusters) {
          seen.add(key);
          clusters.push({ keyword, location, expMin, expMax });
        }
      }
    }
  }

  return clusters.length > 0 ? clusters : DEFAULT_CLUSTERS;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function scrapeNaukri(users = [], { maxClusters = 25 } = {}) {
  const apiKey = process.env.SCRAPERAPI_KEY;
  if (!apiKey || apiKey === 'placeholder') {
    console.warn('[naukri] SCRAPERAPI_KEY not configured — skipping');
    return [];
  }

  const clusters = buildSearchClusters(users, maxClusters);
  const seen     = new Set();
  const all      = [];

  for (const { keyword, location, expMin, expMax } of clusters) {
    try {
      const jobs = await fetchCluster(apiKey, keyword, location, expMin, expMax);
      for (const job of jobs) {
        if (!seen.has(job.description_hash)) {
          seen.add(job.description_hash);
          all.push(job);
        }
      }
      await sleep(1500); // render=true is slow — be generous between calls
    } catch (err) {
      console.warn(`[naukri] cluster ${keyword}@${location} failed:`, err.message);
    }
  }

  console.log(`[naukri] scraped ${all.length} unique jobs from ${clusters.length} clusters`);
  return all;
}

// ── Cluster fetch via ScraperAPI render=true ──────────────────────────────────

async function fetchCluster(apiKey, keyword, location, expMin, expMax) {
  const naukriPath = location === 'india'
    ? `${keyword}-jobs?experience=${expMin}-${expMax}&jobAge=1`
    : `${keyword}-jobs-in-${location}?experience=${expMin}-${expMax}&jobAge=1`;

  const naukriUrl  = `https://www.naukri.com/${naukriPath}`;
  const scraperUrl = `${SCRAPER_API}?api_key=${apiKey}&url=${encodeURIComponent(naukriUrl)}&render=true&country_code=in`;

  const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(50000) });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);

  const html = await res.text();
  return parseNaukriHTML(html, location);
}

// ── HTML parser ───────────────────────────────────────────────────────────────

function parseNaukriHTML(html, location) {
  const $    = load(html);
  const jobs = [];

  // Naukri renders job cards as <article class="jobTuple..."> after JS execution
  $('article[class*="jobTuple"], .jobTuple, [class*="srp-jobtuple"]').each((_, el) => {
    try {
      const $el     = $(el);
      const title   = $el.find('[class*="title"], .jobTitle, a.title').first().text().trim();
      const company = $el.find('[class*="comp-name"], .companyInfo a, [class*="company-name"]').first().text().trim();
      if (!title || !company) return;

      const locText = $el.find('[class*="location"], .loc, [class*="loc"]').first().text().trim() || location;
      const salText = $el.find('[class*="salary"], .salary').first().text().trim();
      const descEl  = $el.find('[class*="job-desc"], .job-description, [class*="description"]').first();
      const descText = stripHtml(descEl.length ? descEl.text() : $el.text()).slice(0, 1500);

      const href = $el.find('a[href*="naukri.com/job-listings"], a[href*="/job/"]').first().attr('href')
                || $el.find('a[title]').first().attr('href');
      const url  = href?.startsWith('http') ? href : `https://www.naukri.com${href || ''}`;

      const salary = parseSalary(salText);

      jobs.push({
        source:           'naukri',
        external_id:      url.split('-').pop()?.split('?')[0] || makeDescHash(title + company),
        title,
        company,
        company_domain:   null,
        description:      descText,
        requirements:     [],
        location:         locText,
        remote_type:      detectRemote(locText + ' ' + descText) ? 'remote' : 'onsite',
        apply_url:        url,
        apply_type:       'naukri',
        department:       null,
        company_stage:    null,
        posted_at:        null,
        salary_min:       salary.salary_min,
        salary_max:       salary.salary_max,
        salary_currency:  salary.salary_currency || 'INR',
        is_active:        true,
        description_hash: makeDescHash(title + company + descText.slice(0, 300)),
      });
    } catch { /* skip malformed card */ }
  });

  console.log(`[naukri] parsed ${jobs.length} jobs`);
  return jobs;
}
