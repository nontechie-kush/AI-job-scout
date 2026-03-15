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

/**
 * Maps signal words found in a user's target_role to canonical Naukri URL slugs.
 * Checked in order — first match wins per entry. Each entry can yield 1-2 slugs.
 *
 * Rules:
 * - Slugs must be valid Naukri URL paths (naukri.com/{slug}-jobs returns results)
 * - One slug per distinct job market (don't combine stack + role into one slug)
 * - Seniority words (Senior, SDE II, AVP, VP) are ignored — Naukri's experience
 *   filter handles seniority, not the URL slug
 * - Stack qualifiers (React, Node, Python) produce a second tech-specific slug
 *   only when that stack has a well-known Naukri search page
 */
const CANONICAL_ROLE_MAP = [
  // ── Product ──────────────────────────────────────────────────────────────
  { match: /product\s*manager|pm\b|head\s+of\s+product/i,        slugs: ['product-manager'] },
  { match: /product\s*analyst/i,                                   slugs: ['product-analyst'] },
  { match: /program\s*manager/i,                                   slugs: ['program-manager'] },
  { match: /project\s*manager/i,                                   slugs: ['project-manager'] },
  { match: /growth\s*manager|growth\s*lead/i,                      slugs: ['growth-manager'] },
  { match: /crm\s*(manager|lead|head)/i,                           slugs: ['crm-manager'] },
  { match: /category\s*manager/i,                                  slugs: ['category-manager'] },
  { match: /operations\s*manager|ops\s*manager/i,                  slugs: ['operations-manager'] },
  { match: /strategy\s*(manager|analyst|consultant)/i,             slugs: ['strategy-manager'] },
  { match: /business\s*analyst|ba\b/i,                             slugs: ['business-analyst'] },
  { match: /business\s*development|bd\s*manager/i,                 slugs: ['business-development-manager'] },

  // ── Engineering — by stack ───────────────────────────────────────────────
  { match: /react\s*native/i,                                      slugs: ['react-native-developer'] },
  { match: /react(\.?js)?(\s*developer|\s*engineer)?/i,            slugs: ['reactjs-developer'] },
  { match: /node(\.?js)?(\s*developer|\s*engineer)?/i,             slugs: ['nodejs-developer'] },
  { match: /python(\s*developer|\s*engineer)?/i,                   slugs: ['python-developer'] },
  { match: /java(\s*developer|\s*engineer)?\b(?!script)/i,         slugs: ['java-developer'] },
  { match: /javascript|js\s*developer/i,                           slugs: ['javascript-developer'] },
  { match: /android(\s*developer|\s*engineer)?/i,                  slugs: ['android-developer'] },
  { match: /ios(\s*developer|\s*engineer)?/i,                      slugs: ['ios-developer'] },
  { match: /flutter(\s*developer)?/i,                              slugs: ['flutter-developer'] },
  { match: /devops|site\s*reliability|sre\b/i,                     slugs: ['devops-engineer'] },
  { match: /data\s*engineer/i,                                     slugs: ['data-engineer'] },
  { match: /data\s*scientist/i,                                     slugs: ['data-scientist'] },
  { match: /machine\s*learning|ml\s*engineer/i,                    slugs: ['machine-learning-engineer'] },
  { match: /ai\s*(engineer|developer)|gen\s*ai|llm\s*engineer/i,  slugs: ['artificial-intelligence'] },
  { match: /frontend|front[\s-]end/i,                              slugs: ['frontend-developer'] },
  { match: /backend|back[\s-]end/i,                                slugs: ['backend-developer'] },
  { match: /full[\s-]?stack/i,                                     slugs: ['full-stack-developer'] },

  // ── Engineering — by level/generic (catch-all after stack checks) ────────
  { match: /engineering\s*manager|em\b/i,                          slugs: ['engineering-manager'] },
  { match: /tech(nical)?\s*lead|tech\s*manager/i,                  slugs: ['technical-lead'] },
  { match: /software\s*(engineer|developer)|sde\b|swe\b/i,         slugs: ['software-engineer'] },

  // ── Design ───────────────────────────────────────────────────────────────
  { match: /ui[\s/]?ux|product\s*design/i,                         slugs: ['ui-ux-designer'] },
  { match: /graphic\s*design/i,                                    slugs: ['graphic-designer'] },

  // ── Sales / Marketing ────────────────────────────────────────────────────
  { match: /sales\s*manager/i,                                     slugs: ['sales-manager'] },
  { match: /account\s*(manager|executive)/i,                       slugs: ['account-manager'] },
  { match: /marketing\s*manager/i,                                  slugs: ['marketing-manager'] },
  { match: /digital\s*marketing/i,                                 slugs: ['digital-marketing-manager'] },
];

/**
 * Maps a user's target_role string to 1-2 canonical Naukri slugs.
 * Falls back to 'software-engineer' if nothing matches.
 */
function extractNaukriKeywords(roleTitle) {
  const input = (roleTitle || '').trim();
  if (!input) return ['software-engineer'];

  const matched = [];
  for (const { match, slugs } of CANONICAL_ROLE_MAP) {
    if (match.test(input)) {
      for (const s of slugs) {
        if (!matched.includes(s)) matched.push(s);
      }
      if (matched.length >= 2) break; // cap at 2 slugs per role
    }
  }

  return matched.length > 0 ? matched : ['software-engineer'];
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

  const final = clusters.length > 0 ? clusters : DEFAULT_CLUSTERS;
  console.log(`[naukri] ${final.length} clusters: ${final.map(c => `${c.keyword}@${c.location}`).join(', ')}`);
  return final;
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
        remote_type:      detectRemote(locText + ' ' + descText),
        apply_url:        url,
        apply_type:       'external',
        department:       null,
        company_stage:    null,
        posted_at:        new Date().toISOString(), // scraped today; jobAge=1 filter means these are recent
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
