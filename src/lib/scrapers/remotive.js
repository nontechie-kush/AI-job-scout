/**
 * Remotive scraper — official public API
 * GET https://remotive.com/api/remote-jobs?category=software-dev&limit=100
 *
 * Free, no auth. Focused on fully remote roles.
 */

import { stripHtml, detectRemote, makeDescHash, parseSalary } from './index';

const CATEGORIES = ['software-dev', 'product', 'design', 'data'];
const BASE = 'https://remotive.com/api/remote-jobs';

export async function scrapeRemotive() {
  const jobs = [];
  const seen = new Set();

  for (const category of CATEGORIES) {
    try {
      const res = await fetch(`${BASE}?category=${category}&limit=100`, {
        headers: { 'User-Agent': 'CareerPilot/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[remotive] category ${category}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const listings = data.jobs || [];

      for (const job of listings) {
        const id = String(job.id);
        if (seen.has(id)) continue;
        seen.add(id);

        const desc = stripHtml(job.description || '');
        const location = job.candidate_required_location || 'Remote';
        const salary = parseSalary(job.salary || '');

        jobs.push({
          source: 'remotive',
          external_id: id,
          title: job.title,
          company: job.company_name,
          company_domain: extractDomain(job.url) || `${job.company_name.toLowerCase().replace(/\s+/g, '')}.com`,
          description: desc.slice(0, 8000),
          requirements: [],
          location,
          remote_type: 'remote', // all Remotive jobs are remote
          apply_url: job.url,
          apply_type: 'external',
          department: job.category || null,
          company_stage: 'unknown',
          posted_at: job.publication_date || null,
          ...salary,
          description_hash: makeDescHash(job.company_name, job.title, desc),
        });
      }
    } catch (err) {
      console.warn(`[remotive] category ${category}: ${err.message}`);
    }
  }

  console.log(`[remotive] scraped ${jobs.length} jobs`);
  return jobs;
}

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // For remotive.com links, skip
    if (hostname === 'remotive.com') return null;
    return hostname;
  } catch {
    return null;
  }
}
