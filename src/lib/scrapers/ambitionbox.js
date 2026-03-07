/**
 * AmbitionBox scraper — India company culture & ratings
 * ambitionbox.com is less protected than Glassdoor and works with direct fetch.
 *
 * Returns: { rating, wlb_score, growth_score, recommend_pct, reviews_snippet }
 * Returns: null on any failure — callers must handle gracefully.
 */

import { load } from 'cheerio';

const BASE = 'https://www.ambitionbox.com';

export async function scrapeAmbitionBox(companyName) {
  try {
    // AmbitionBox URL format: /overview/{company-slug}-overview
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const overviewUrl = `${BASE}/overview/${slug}-overview`;

    const res = await fetch(overviewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        Referer: BASE,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      // Try search as fallback
      return await searchAmbitionBox(companyName);
    }

    const html = await res.text();
    const $ = load(html);

    // Try JSON-LD first
    let rating = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        if (data?.aggregateRating?.ratingValue) {
          rating = parseFloat(data.aggregateRating.ratingValue);
        }
      } catch { /* ignore */ }
    });

    // Try meta tags
    if (!rating) {
      const metaRating = $('meta[property="og:rating"], meta[name="rating"]').attr('content');
      if (metaRating) rating = parseFloat(metaRating);
    }

    // HTML selectors
    if (!rating) {
      const ratingEl = $(
        '[class*="rating-number"], [class*="ratingNumber"], [class*="overallRating"], .overall-rating'
      ).first().text().trim();
      rating = parseFloat(ratingEl) || null;
    }

    if (!rating) return null;

    // Extract category scores
    const wlb = extractScore($, ['work-life-balance', 'worklife', 'wlb', 'work life']);
    const growth = extractScore($, ['growth', 'career', 'promotion']);
    const recommendText = $('[class*="recommend"]').first().text().trim();
    const recommendMatch = recommendText.match(/(\d+)%/);

    // Extract a review snippet
    const reviewSnippet = $('[class*="review-text"], [class*="pros"], .review-body').first().text().trim().slice(0, 400) || null;

    return {
      rating,
      wlb_score: wlb,
      growth_score: growth,
      recommend_pct: recommendMatch ? parseInt(recommendMatch[1]) : null,
      reviews_snippet: reviewSnippet,
    };
  } catch (err) {
    console.warn(`[ambitionbox] ${companyName}: ${err.message}`);
    return null;
  }
}

async function searchAmbitionBox(companyName) {
  try {
    const searchUrl = `${BASE}/search?q=${encodeURIComponent(companyName)}&type=company`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerPilot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = load(html);

    // Find first company result
    const firstLink = $('[class*="company-name"] a, [class*="CompanyCard"] a').first().attr('href');
    if (!firstLink) return null;

    // Follow the link
    const companyUrl = firstLink.startsWith('http') ? firstLink : `${BASE}${firstLink}`;
    const res2 = await fetch(companyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerPilot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res2.ok) return null;

    const html2 = await res2.text();
    const $2 = load(html2);
    const ratingEl = $2('[class*="ratingNumber"], [class*="overallRating"]').first().text().trim();
    const rating = parseFloat(ratingEl) || null;

    return rating ? { rating, wlb_score: null, growth_score: null, recommend_pct: null, reviews_snippet: null } : null;
  } catch {
    return null;
  }
}

function extractScore($, keywords) {
  let score = null;
  $('[class*="category"], [class*="Category"], [class*="parameter"]').each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (keywords.some((kw) => text.includes(kw))) {
      const numMatch = text.match(/(\d+(\.\d+)?)/);
      if (numMatch) { score = parseFloat(numMatch[1]); return false; }
    }
  });
  return score;
}
