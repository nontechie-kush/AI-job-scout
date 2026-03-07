/**
 * NextLeap scraper — India PM + tech jobs community
 * nextleap.app curates high-quality startup jobs.
 */

import { load } from 'cheerio';
import { stripHtml, detectRemote, makeDescHash } from './index';

const BASE = 'https://nextleap.app';
const URLS = [`${BASE}/jobs`, `${BASE}/jobs?role=Product+Manager`, `${BASE}/jobs?role=Software+Engineer`];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeNextLeap() {
  const jobs = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) { console.warn(`[nextleap] HTTP ${res.status}`); continue; }

      const html = await res.text();
      const $ = load(html);

      // Try Next.js data
      const nextDataRaw = $('#__NEXT_DATA__').text();
      if (nextDataRaw) {
        try {
          const nextData = JSON.parse(nextDataRaw);
          const parsed = extractNextLeapNextData(nextData);
          parsed.forEach((j) => { if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); } });
          await sleep(500);
          continue;
        } catch { /* fall through */ }
      }

      const parsed = extractNextLeapHTML($);
      parsed.forEach((j) => { if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); } });
      await sleep(500);
    } catch (err) {
      console.warn(`[nextleap] ${url}: ${err.message}`);
    }
  }

  console.log(`[nextleap] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractNextLeapNextData(nextData) {
  const jobs = [];
  const listings =
    nextData?.props?.pageProps?.jobs ||
    nextData?.props?.pageProps?.data ||
    nextData?.props?.pageProps?.jobListings ||
    [];

  for (const job of listings) {
    if (!job.title) continue;
    const company = job.company || job.companyName || 'Unknown';
    const location = job.location || 'India';
    const desc = stripHtml(job.description || '');

    jobs.push({
      source: 'nextleap',
      external_id: String(job.id || job.slug || `${company}-${job.title}`),
      title: job.title,
      company,
      company_domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: desc.slice(0, 8000),
      requirements: [],
      location,
      remote_type: detectRemote(location),
      apply_url: job.url || job.applyUrl || `${BASE}/jobs/${job.slug}`,
      apply_type: 'external',
      department: null,
      company_stage: 'unknown',
      posted_at: job.postedAt || null,
      salary_min: null,
      salary_max: null,
      salary_currency: 'INR',
      description_hash: makeDescHash(company, job.title, desc),
    });
  }

  return jobs;
}

function extractNextLeapHTML($) {
  const jobs = [];

  $('[class*="job"], [class*="card"], article').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="title"], h2, h3').first().text().trim();
    const company = $el.find('[class*="company"]').first().text().trim();
    if (!title || !company) return;

    const location = $el.find('[class*="location"]').first().text().trim() || 'India';
    const href = $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const desc = `${title} at ${company}`;

    jobs.push({
      source: 'nextleap',
      external_id: url,
      title,
      company,
      company_domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: desc,
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
      salary_currency: 'INR',
      description_hash: makeDescHash(company, title, desc),
    });
  });

  return jobs;
}
