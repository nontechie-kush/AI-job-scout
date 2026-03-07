/**
 * Lever scraper — official public API
 * GET https://api.lever.co/v0/postings/{slug}?mode=json
 *
 * No auth required. Public job boards only.
 */

import { stripHtml, detectRemote, makeDescHash } from './index';

const COMPANIES = [
  // US
  ['netflix', 'Netflix', 'netflix.com'],
  ['yelp', 'Yelp', 'yelp.com'],
  ['samsara', 'Samsara', 'samsara.com'],
  ['verkada', 'Verkada', 'verkada.com'],
  ['front', 'Front', 'front.com'],
  ['gem', 'Gem', 'gem.com'],
  ['ironclad', 'Ironclad', 'ironcladapp.com'],
  ['pilot', 'Pilot', 'pilot.com'],
  ['mercury', 'Mercury', 'mercury.com'],
  ['pipe', 'Pipe', 'pipe.com'],
  ['attentive', 'Attentive', 'attentivemobile.com'],
  ['alphasense', 'AlphaSense', 'alpha-sense.com'],
  ['sendbird', 'Sendbird', 'sendbird.com'],
  ['gong', 'Gong', 'gong.io'],
  ['clickhouse', 'ClickHouse', 'clickhouse.com'],
  // India
  ['meesho', 'Meesho', 'meesho.com'],
  ['cred', 'CRED', 'cred.club'],
  ['swiggy', 'Swiggy', 'swiggy.com'],
  ['groww', 'Groww', 'groww.in'],
  ['zomato', 'Zomato', 'zomato.com'],
  ['paytm', 'Paytm', 'paytm.com'],
  ['zepto', 'Zepto', 'zeptonow.com'],
  ['blinkit', 'Blinkit', 'blinkit.com'],
  ['slice', 'Slice', 'sliceit.in'],
  ['urbancompany', 'Urban Company', 'urbancompany.com'],
  ['dream11', 'Dream11', 'dream11.com'],
  ['nykaa', 'Nykaa', 'nykaa.com'],
  ['sharechat', 'ShareChat', 'sharechat.com'],
  ['ola', 'Ola', 'olacabs.com'],
  ['olaelectric', 'Ola Electric', 'olaelectric.com'],
  ['physicswallah', 'Physics Wallah', 'pw.live'],
  ['upgrad', 'upGrad', 'upgrad.com'],
  ['cars24', 'CARS24', 'cars24.com'],
  ['pristyncare', 'Pristyn Care', 'pristyncare.com'],
  ['ofbusiness', 'OfBusiness', 'ofbusiness.com'],
  // Global — VC-backed / high-growth
  ['shopify', 'Shopify', 'shopify.com'],
  ['canva', 'Canva', 'canva.com'],
  ['dropbox', 'Dropbox', 'dropbox.com'],
  ['squarespace', 'Squarespace', 'squarespace.com'],
  ['thoughtspot', 'ThoughtSpot', 'thoughtspot.com'],
  ['brex', 'Brex', 'brex.com'],
  ['benchling', 'Benchling', 'benchling.com'],
  ['pendo', 'Pendo', 'pendo.io'],
  ['mixpanel', 'Mixpanel', 'mixpanel.com'],
  ['highspot', 'Highspot', 'highspot.com'],
];

const BASE = 'https://api.lever.co/v0/postings';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeLever() {
  const jobs = [];

  for (const [slug, company, domain] of COMPANIES) {
    try {
      const res = await fetch(`${BASE}/${slug}?mode=json`, {
        headers: { 'User-Agent': 'CareerPilot/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status !== 404) console.warn(`[lever] ${slug}: HTTP ${res.status}`);
        await sleep(150);
        continue;
      }

      const listings = await res.json();
      if (!Array.isArray(listings)) { await sleep(150); continue; }

      for (const job of listings) {
        const location = job.categories?.location || job.categories?.allLocations?.[0] || '';
        const desc = stripHtml(job.descriptionPlain || job.description || '');

        jobs.push({
          source: 'lever',
          external_id: job.id,
          title: job.text,
          company,
          company_domain: domain,
          description: desc.slice(0, 8000),
          requirements: [],
          location,
          remote_type: detectRemote(`${location} ${job.categories?.commitment || ''}`),
          apply_url: job.hostedUrl,
          apply_type: 'lever',
          department: job.categories?.department || job.categories?.team || null,
          company_stage: 'unknown',
          posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : null,
          salary_min: job.salaryRange?.min ?? null,
          salary_max: job.salaryRange?.max ?? null,
          salary_currency: job.salaryRange?.currency || 'USD',
          description_hash: makeDescHash(company, job.text, desc),
        });
      }

      await sleep(150);
    } catch (err) {
      console.warn(`[lever] ${slug}: ${err.message}`);
    }
  }

  console.log(`[lever] scraped ${jobs.length} jobs`);
  return jobs;
}
