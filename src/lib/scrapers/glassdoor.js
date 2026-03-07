/**
 * Glassdoor scraper — company culture & ratings
 *
 * Glassdoor is heavily protected. Requires SCRAPERAPI_KEY with render=true
 * for reliable results. Falls back to direct fetch (will usually fail).
 *
 * Returns: { rating, recommend_pct, ceo_approval, wlb_score, culture_score, reviews_snippet }
 * Returns: null on any failure — callers must handle gracefully.
 */

import { load } from 'cheerio';

export async function scrapeGlassdoor(companyName, companyDomain) {
  try {
    const scraperKey = process.env.SCRAPERAPI_KEY;

    // Search for the company on Glassdoor to find their review page
    const searchSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const searchUrl = `https://www.glassdoor.com/Reviews/${searchSlug}-reviews-SRCH_KE0,${searchSlug.length}.htm`;

    const fetchUrl = scraperKey
      ? `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchUrl)}&render=true&country_code=us`
      : searchUrl;

    const res = await fetch(fetchUrl, {
      headers: scraperKey
        ? {}
        : {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
          },
      signal: AbortSignal.timeout(scraperKey ? 25000 : 10000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = load(html);

    // Try to extract from Next.js data or structured data first
    const nextDataRaw = $('#__NEXT_DATA__').text();
    if (nextDataRaw) {
      try {
        const nextData = JSON.parse(nextDataRaw);
        const employer = findEmployerData(nextData);
        if (employer) return employer;
      } catch { /* fall through */ }
    }

    // Try JSON-LD structured data
    let structuredData = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        if (data?.aggregateRating) structuredData = data;
      } catch { /* ignore */ }
    });

    if (structuredData?.aggregateRating) {
      return {
        rating: parseFloat(structuredData.aggregateRating.ratingValue) || null,
        recommend_pct: null,
        ceo_approval: null,
        wlb_score: null,
        culture_score: null,
        reviews_snippet: null,
      };
    }

    // HTML fallback — Glassdoor DOM selectors (fragile, change with their releases)
    const ratingText = $('[class*="ratingNum"], [class*="ratingValue"], [data-test="overall-rating"]').first().text().trim();
    const rating = parseFloat(ratingText) || null;

    if (!rating) return null;

    const recommendText = $('[class*="recommend"], [data-test="recommend-friend"]').first().text().trim();
    const recommendMatch = recommendText.match(/(\d+)%/);

    return {
      rating,
      recommend_pct: recommendMatch ? parseInt(recommendMatch[1]) : null,
      ceo_approval: null,
      wlb_score: null,
      culture_score: null,
      reviews_snippet: $('[class*="review"], [data-test="review-text"]').first().text().trim().slice(0, 500) || null,
    };
  } catch (err) {
    console.warn(`[glassdoor] ${companyName}: ${err.message}`);
    return null;
  }
}

function findEmployerData(nextData) {
  // Walk the props tree to find employer ratings
  const walk = (obj, depth = 0) => {
    if (depth > 6 || !obj || typeof obj !== 'object') return null;
    if (obj.overallRating || obj.ratingOverall) {
      return {
        rating: obj.overallRating || obj.ratingOverall || null,
        recommend_pct: obj.recommendToFriendRating || obj.recommendPct || null,
        ceo_approval: obj.ceoRating || obj.ceoApproval || null,
        wlb_score: obj.workLifeBalance || obj.wlbScore || null,
        culture_score: obj.culture || obj.cultureScore || null,
        reviews_snippet: obj.featuredReview?.pros || null,
      };
    }
    for (const val of Object.values(obj)) {
      const found = walk(val, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(nextData?.props);
}
