/**
 * YC Work at a Startup scraper
 * Fetches the jobs JSON from workatastartup.com
 *
 * They render via Next.js — we grab the __NEXT_DATA__ JSON from the HTML.
 * Fallback: parse job cards from static HTML.
 */

import { load } from 'cheerio';
import { stripHtml, detectRemote, makeDescHash } from './index';

const BASE_URL = 'https://www.workatastartup.com';

export async function scrapeYC() {
  const res = await fetch(`${BASE_URL}/jobs`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = load(html);

  // Try to extract Next.js pre-rendered data
  const nextDataEl = $('#__NEXT_DATA__').text();
  if (nextDataEl) {
    try {
      const nextData = JSON.parse(nextDataEl);
      const jobs = extractFromNextData(nextData);
      if (jobs.length > 0) {
        console.log(`[yc] scraped ${jobs.length} jobs (next_data)`);
        return jobs;
      }
    } catch {
      // Fall through to HTML parsing
    }
  }

  // Fallback: parse visible job cards
  const jobs = extractFromHTML($);
  console.log(`[yc] scraped ${jobs.length} jobs (html)`);
  return jobs;
}

function extractFromNextData(nextData) {
  const jobs = [];

  // Walk the props tree looking for job arrays
  const pageProps = nextData?.props?.pageProps;
  const roles = pageProps?.roles || pageProps?.jobs || pageProps?.companyRoles || [];

  for (const job of roles) {
    if (!job.title) continue;
    const company = job.company?.name || job.companyName || 'Unknown';
    const domain = job.company?.url ? extractDomain(job.company.url) : `${company.toLowerCase().replace(/\s+/g, '')}.com`;
    const location = job.location || job.remoteOk ? 'Remote' : 'San Francisco, CA';
    const desc = stripHtml(job.description || '');

    jobs.push({
      source: 'yc',
      external_id: String(job.id || job.slug || `${company}-${job.title}`),
      title: job.title,
      company,
      company_domain: domain,
      description: desc.slice(0, 8000),
      requirements: [],
      location,
      remote_type: detectRemote(location + (job.remoteOk ? ' remote' : '')),
      apply_url: job.url || `${BASE_URL}/jobs/${job.id}`,
      apply_type: 'external',
      department: null,
      company_stage: inferYCStage(job.company?.batch),
      posted_at: job.createdAt || null,
      salary_min: job.minExperience ? null : null, // YC rarely provides salary
      salary_max: null,
      salary_currency: 'USD',
      description_hash: makeDescHash(company, job.title, desc),
    });
  }

  return jobs;
}

function extractFromHTML($) {
  const jobs = [];

  $('[class*="job"], [data-company-id], .company-role').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="title"], h2, h3').first().text().trim();
    const company = $el.find('[class*="company"], [class*="name"]').first().text().trim();
    const location = $el.find('[class*="location"]').first().text().trim() || 'Remote';
    const href = $el.find('a').first().attr('href');

    if (!title || !company) return;

    const url = href?.startsWith('http') ? href : `${BASE_URL}${href}`;
    const desc = stripHtml($el.text());

    jobs.push({
      source: 'yc',
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
      company_stage: 'seed', // YC = seed/early
      posted_at: null,
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      description_hash: makeDescHash(company, title, desc),
    });
  });

  return jobs;
}

function inferYCStage(batch) {
  if (!batch) return 'seed';
  // YC batch companies are early-stage
  return 'series_a'; // conservative: most YC companies at job listing time are series A
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
