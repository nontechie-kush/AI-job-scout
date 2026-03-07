/**
 * IIMJobs scraper — India's senior/leadership jobs board (7+ LPA)
 * Focused on PM, leadership, strategy, finance roles.
 * Requires SCRAPERAPI_KEY for reliable results (heavily bot-protected).
 */

import { load } from 'cheerio';
import { detectRemote, makeDescHash, parseSalary } from './index';

const SEARCH_URLS = [
  'https://www.iimjobs.com/j/product-management-jobs-1.html',
  'https://www.iimjobs.com/j/technology-jobs-1.html',
  'https://www.iimjobs.com/j/general-management-jobs-1.html',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeIIMJobs() {
  const scraperKey = process.env.SCRAPERAPI_KEY;
  if (!scraperKey) {
    throw new Error('SCRAPERAPI_KEY required for IIMJobs. Set it to enable this source.');
  }

  const jobs = [];
  const seen = new Set();

  for (const searchUrl of SEARCH_URLS) {
    try {
      const fetchUrl = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchUrl)}&country_code=in`;

      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(25000) });
      if (!res.ok) { console.warn(`[iimjobs] HTTP ${res.status}`); continue; }

      const html = await res.text();
      const $ = load(html);
      const pageJobs = extractIIMJobs($);

      pageJobs.forEach((j) => {
        if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); }
      });

      await sleep(1500);
    } catch (err) {
      console.warn(`[iimjobs] ${searchUrl}: ${err.message}`);
    }
  }

  console.log(`[iimjobs] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractIIMJobs($) {
  const jobs = [];
  const BASE = 'https://www.iimjobs.com';

  $('.job-list li, .jobListItem, [class*="job-item"]').each((_, el) => {
    const $el = $(el);

    const title = $el.find('.job-title, h2, h3, [class*="title"]').first().text().trim();
    const company = $el.find('.company-name, [class*="company"]').first().text().trim();
    if (!title || !company) return;

    const location = $el.find('[class*="location"], .loc').first().text().trim() || 'India';
    const salaryText = $el.find('[class*="salary"], .ctc').first().text().trim();
    const href = $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const salary = parseSalary(salaryText);

    jobs.push({
      source: 'iimjobs',
      external_id: url,
      title,
      company,
      company_domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: `${title} at ${company} — ${location}`,
      requirements: [],
      location,
      remote_type: detectRemote(location),
      apply_url: url,
      apply_type: 'iimjobs',
      department: null,
      company_stage: 'unknown',
      posted_at: null,
      ...salary,
      description_hash: makeDescHash(company, title, location),
    });
  });

  return jobs;
}
