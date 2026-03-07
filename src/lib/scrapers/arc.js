/**
 * Arc.dev scraper — remote job board for senior developers
 * Scrapes their public job listing page.
 */

import { load } from 'cheerio';
import { stripHtml, detectRemote, makeDescHash, parseSalary } from './index';

const BASE = 'https://arc.dev';
const SEARCH_URLS = [
  `${BASE}/remote-jobs/product-manager`,
  `${BASE}/remote-jobs/software-engineer`,
  `${BASE}/remote-jobs`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeArc() {
  const jobs = [];
  const seen = new Set();

  for (const url of SEARCH_URLS) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) { console.warn(`[arc] ${url}: HTTP ${res.status}`); continue; }

      const html = await res.text();
      const $ = load(html);

      // Try Next.js data
      const nextDataRaw = $('#__NEXT_DATA__').text();
      if (nextDataRaw) {
        try {
          const nextData = JSON.parse(nextDataRaw);
          const parsed = extractArcNextData(nextData);
          parsed.forEach((j) => { if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); } });
          await sleep(800);
          continue;
        } catch { /* fall through */ }
      }

      const parsed = extractArcHTML($);
      parsed.forEach((j) => { if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); } });
      await sleep(800);
    } catch (err) {
      console.warn(`[arc] ${url}: ${err.message}`);
    }
  }

  console.log(`[arc] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractArcNextData(nextData) {
  const jobs = [];
  const listings =
    nextData?.props?.pageProps?.jobs ||
    nextData?.props?.pageProps?.jobListings ||
    nextData?.props?.pageProps?.data?.jobs ||
    [];

  for (const job of listings) {
    if (!job.title) continue;
    const company = job.company?.name || job.companyName || 'Unknown';
    const desc = stripHtml(job.description || '');
    const location = job.location || job.locationStr || 'Remote';
    const salary = parseSalary(job.salary || job.compensation || '');

    jobs.push({
      source: 'arc',
      external_id: String(job.id || job.slug),
      title: job.title,
      company,
      company_domain: job.company?.website ? extractDomain(job.company.website) : `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: desc.slice(0, 8000),
      requirements: Array.isArray(job.skills) ? job.skills.slice(0, 10) : [],
      location,
      remote_type: 'remote', // Arc is remote-first
      apply_url: job.applyUrl || job.url || `${BASE}/remote-jobs/${job.slug}`,
      apply_type: 'external',
      department: null,
      company_stage: 'unknown',
      posted_at: job.publishedAt || null,
      ...salary,
      description_hash: makeDescHash(company, job.title, desc),
    });
  }

  return jobs;
}

function extractArcHTML($) {
  const jobs = [];

  $('[class*="job-card"], [class*="JobCard"], [data-job-id]').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="title"], h2, h3').first().text().trim();
    const company = $el.find('[class*="company"]').first().text().trim();
    if (!title || !company) return;

    const salary = $el.find('[class*="salary"], [class*="compensation"]').first().text().trim();
    const href = $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const desc = `${title} at ${company}`;

    jobs.push({
      source: 'arc',
      external_id: url,
      title,
      company,
      company_domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: desc,
      requirements: [],
      location: 'Remote',
      remote_type: 'remote',
      apply_url: url,
      apply_type: 'external',
      department: null,
      company_stage: 'unknown',
      posted_at: null,
      ...parseSalary(salary),
      description_hash: makeDescHash(company, title, desc),
    });
  });

  return jobs;
}

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
