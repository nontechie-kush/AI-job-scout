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
  if (!scraperKey || scraperKey === 'placeholder') {
    console.log('[iimjobs] no SCRAPERAPI_KEY — skipping');
    return [];
  }

  const jobs = [];
  const seen = new Set();

  for (const searchUrl of SEARCH_URLS) {
    try {
      // render=true required — IIMJobs is bot-protected and JS-renders job cards
      const fetchUrl = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(searchUrl)}&render=true&country_code=in&wait=2000`;

      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(40000) });
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

  // IIMJobs renders job cards with these selectors (verified against current markup patterns)
  const cardSelectors = [
    '.job-list-item',
    '.job_list_row',
    '[class*="job-list"] li',
    '[class*="jobList"] li',
    '.jobList li',
    '.srp-jobtuple-wrapper',
    '[data-job-id]',
  ];
  const container = cardSelectors.reduce((acc, sel) => acc.length ? acc : $(sel), $());

  container.each((_, el) => {
    const $el = $(el);

    // Try multiple title selectors
    const title = (
      $el.find('.job-title a, .jobtitle a, [class*="job-title"] a, h3 a, h2 a').first().text() ||
      $el.find('.job-title, .jobtitle, [class*="title"]').first().text()
    ).trim();

    // Try multiple company selectors
    const company = (
      $el.find('.company-name, [class*="company-name"], [class*="companyName"]').first().text() ||
      $el.find('[class*="company"]').first().text()
    ).trim();

    if (!title || !company) return;

    const location = (
      $el.find('[class*="location"], .loc, [class*="loc"]').first().text()
    ).trim() || 'India';

    const salaryText = $el.find('[class*="salary"], [class*="Salary"], .ctc, [class*="ctc"]').first().text().trim();
    const href = $el.find('a[href*="/c-jobs-"], a[href*="/job/"], a[href*=".html"]').first().attr('href')
      || $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const salary = parseSalary(salaryText);
    const desc = `${title} at ${company} — ${location}${salaryText ? '. Salary: ' + salaryText : ''}`;

    jobs.push({
      source: 'iimjobs',
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
      company_stage: null,
      posted_at: null,
      ...salary,
      description_hash: makeDescHash(company, title, location),
    });
  });

  if (jobs.length === 0) {
    // Log page structure to help debug selector mismatches
    const bodyClasses = $('body').attr('class') || '';
    const firstLi = $('li').first().attr('class') || '';
    console.warn(`[iimjobs] 0 jobs found. body class: "${bodyClasses.slice(0,50)}", first li: "${firstLi.slice(0,50)}"`);
  }

  return jobs;
}
