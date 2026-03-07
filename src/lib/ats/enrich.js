/**
 * Naukri / IIMJobs enrichment — detects the company's real ATS apply URL.
 *
 * Both platforms show two apply modes:
 *   1. "Apply on company website" → links to company's ATS (Greenhouse/Lever/Workday/etc.)
 *   2. "Apply on Naukri/IIMJobs"  → native platform apply (profile + cover note)
 *
 * We fetch the listing page via ScraperAPI, look for external ATS links,
 * and return the real URL if found. Falls back to null (native apply) if:
 *   - SCRAPERAPI_KEY is not set
 *   - Fetch fails or times out
 *   - No external ATS link found (genuine native apply)
 *
 * Exports:
 *   enrichApplyUrl(listingUrl) → string | null
 *     Returns the company's ATS URL, or null if native apply / unavailable.
 */

import { load } from 'cheerio';

// ATS patterns we can handle — same ones our fetchATSQuestions supports
// plus broader patterns (Workday, Taleo) even though we can't fetch their questions
const ATS_URL_PATTERNS = [
  /greenhouse\.io/,
  /lever\.co/,
  /ashbyhq\.com/,
  /myworkdayjobs\.com/,
  /workday\.com/,
  /taleo\.net/,
  /smartrecruiters\.com/,
  /icims\.com/,
  /brassring\.com/,
];

function isAtsUrl(href = '') {
  return ATS_URL_PATTERNS.some((p) => p.test(href));
}

function isNaukriOrIIMJobs(url = '') {
  return url.includes('naukri.com') || url.includes('iimjobs.com');
}

/**
 * Given a Naukri or IIMJobs listing URL, fetches the page via ScraperAPI
 * and looks for a company ATS apply link.
 *
 * @param {string} listingUrl — Naukri/IIMJobs job listing page URL
 * @returns {Promise<string|null>} — Company ATS URL, or null for native apply
 */
export async function enrichApplyUrl(listingUrl) {
  if (!listingUrl || !isNaukriOrIIMJobs(listingUrl)) return null;

  const scraperKey = process.env.SCRAPERAPI_KEY;
  if (!scraperKey) {
    // No ScraperAPI configured — can't enrich, treat as native apply
    return null;
  }

  try {
    const isNaukri = listingUrl.includes('naukri.com');
    const apiUrl = new URL('https://api.scraperapi.com');
    apiUrl.searchParams.set('api_key', scraperKey);
    apiUrl.searchParams.set('url', listingUrl);
    apiUrl.searchParams.set('country_code', 'in');
    if (isNaukri) {
      // Naukri uses React — needs JS rendering
      apiUrl.searchParams.set('render', 'true');
    }

    const res = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = load(html);

    let atsUrl = null;

    // Search all links for an ATS URL
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (isAtsUrl(href)) {
        atsUrl = href.startsWith('http') ? href : `https:${href}`;
        return false; // break
      }
    });

    // Also check data attributes (some Naukri buttons store the URL in data-*)
    if (!atsUrl) {
      $('[data-apply-url], [data-href], [data-link]').each((_, el) => {
        const href = $(el).attr('data-apply-url') || $(el).attr('data-href') || $(el).attr('data-link') || '';
        if (isAtsUrl(href)) {
          atsUrl = href.startsWith('http') ? href : `https:${href}`;
          return false;
        }
      });
    }

    return atsUrl;
  } catch {
    // Timeout or fetch error — silently return null (native apply fallback)
    return null;
  }
}

/**
 * Returns true if the URL is a Naukri or IIMJobs listing page
 * (as opposed to a direct company ATS URL).
 */
export function isIndianJobBoard(url = '') {
  return isNaukriOrIIMJobs(url);
}
