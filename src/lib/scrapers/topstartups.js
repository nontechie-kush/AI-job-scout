/**
 * TopStartups.io scraper — curated startup jobs India + global
 */

import { load } from 'cheerio';
import { stripHtml, detectRemote, makeDescHash } from './index';

const BASE = 'https://topstartups.io';
const URLS = [
  `${BASE}/?category=Product+Management`,
  `${BASE}/?category=Software+Engineering`,
  `${BASE}/?category=Data+%26+Analytics`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeTopStartups() {
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

      if (!res.ok) { console.warn(`[topstartups] ${url}: HTTP ${res.status}`); continue; }

      const html = await res.text();
      const $ = load(html);
      const pageJobs = extractTopStartupsJobs($);

      pageJobs.forEach((j) => {
        if (!seen.has(j.external_id)) { seen.add(j.external_id); jobs.push(j); }
      });

      await sleep(600);
    } catch (err) {
      console.warn(`[topstartups] ${url}: ${err.message}`);
    }
  }

  console.log(`[topstartups] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractTopStartupsJobs($) {
  const jobs = [];

  $('[class*="startup"], [class*="job-card"], [class*="company-card"]').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="role"], [class*="job-title"], [class*="title"]').first().text().trim();
    const company = $el.find('[class*="company"], [class*="startup-name"], h2, h3').first().text().trim();
    if (!title || !company) return;

    const location = $el.find('[class*="location"]').first().text().trim() || 'India/Remote';
    const href = $el.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const desc = stripHtml($el.text()).slice(0, 1000);

    jobs.push({
      source: 'topstartups',
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
      company_stage: 'seed', // TopStartups focuses on early-stage
      posted_at: null,
      salary_min: null,
      salary_max: null,
      salary_currency: 'INR',
      description_hash: makeDescHash(company, title, desc),
    });
  });

  return jobs;
}
