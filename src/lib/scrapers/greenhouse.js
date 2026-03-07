/**
 * Greenhouse scraper — official public API
 * GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *
 * No auth required. Companies must be curated (no global search API).
 */

import { stripHtml, detectRemote, makeDescHash } from './index';

// [slug, displayName, domain]
const COMPANIES = [
  // US
  ['stripe', 'Stripe', 'stripe.com'],
  ['brex', 'Brex', 'brex.com'],
  ['plaid', 'Plaid', 'plaid.com'],
  ['rippling', 'Rippling', 'rippling.com'],
  ['databricks', 'Databricks', 'databricks.com'],
  ['amplitude', 'Amplitude', 'amplitude.com'],
  ['retool', 'Retool', 'retool.com'],
  ['notion', 'Notion', 'notion.so'],
  ['navan', 'Navan', 'navan.com'],
  ['carta', 'Carta', 'carta.com'],
  ['benchling', 'Benchling', 'benchling.com'],
  ['miro', 'Miro', 'miro.com'],
  ['deel', 'Deel', 'deel.com'],
  ['lattice', 'Lattice', 'lattice.com'],
  ['coinbase', 'Coinbase', 'coinbase.com'],
  ['figma', 'Figma', 'figma.com'],
  ['airtable', 'Airtable', 'airtable.com'],
  ['klaviyo', 'Klaviyo', 'klaviyo.com'],
  ['segment', 'Segment', 'segment.com'],
  ['duolingo', 'Duolingo', 'duolingo.com'],
  ['robinhood', 'Robinhood', 'robinhood.com'],
  ['intercom', 'Intercom', 'intercom.com'],
  ['gusto', 'Gusto', 'gusto.com'],
  ['loom', 'Loom', 'loom.com'],
  // India
  ['razorpay', 'Razorpay', 'razorpay.com'],
  ['freshworks', 'Freshworks', 'freshworks.com'],
  ['postman', 'Postman', 'postman.com'],
  ['chargebee', 'Chargebee', 'chargebee.com'],
  ['clevertap', 'CleverTap', 'clevertap.com'],
  ['druva', 'Druva', 'druva.com'],
  ['innovaccer', 'Innovaccer', 'innovaccer.com'],
  ['lenskart', 'Lenskart', 'lenskart.com'],
  ['unacademy', 'Unacademy', 'unacademy.com'],
  ['meesho', 'Meesho', 'meesho.com'],
  ['moengage', 'MoEngage', 'moengage.com'],
  ['darwinbox', 'Darwinbox', 'darwinbox.com'],
  ['leadsquared', 'LeadSquared', 'leadsquared.com'],
  ['sprinklr', 'Sprinklr', 'sprinklr.com'],
  ['exotel', 'Exotel', 'exotel.com'],
  ['cashfree', 'Cashfree', 'cashfree.com'],
  ['setu', 'Setu', 'setu.co'],
  ['browserstack', 'BrowserStack', 'browserstack.com'],
  ['whatfix', 'Whatfix', 'whatfix.com'],
  ['yellowmessenger', 'Yellow.ai', 'yellow.ai'],
  // Global — VC-backed / high-growth
  ['twilio', 'Twilio', 'twilio.com'],
  ['cloudflare', 'Cloudflare', 'cloudflare.com'],
  ['mongodb', 'MongoDB', 'mongodb.com'],
  ['pagerduty', 'PagerDuty', 'pagerduty.com'],
  ['elastic', 'Elastic', 'elastic.co'],
  ['okta', 'Okta', 'okta.com'],
  ['confluent', 'Confluent', 'confluent.io'],
  ['hubspot', 'HubSpot', 'hubspot.com'],
  ['gitlab', 'GitLab', 'gitlab.com'],
  ['lyft', 'Lyft', 'lyft.com'],
  ['asana', 'Asana', 'asana.com'],
  ['box', 'Box', 'box.com'],
  ['zendesk', 'Zendesk', 'zendesk.com'],
];

const BASE = 'https://boards-api.greenhouse.io/v1/boards';
const DELAY_MS = 200; // polite delay between company fetches

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeGreenhouse() {
  const jobs = [];

  for (const [slug, company, domain] of COMPANIES) {
    try {
      const res = await fetch(`${BASE}/${slug}/jobs?content=true`, {
        headers: { 'User-Agent': 'CareerPilot/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        // 404 = company not on Greenhouse — skip silently
        if (res.status !== 404) console.warn(`[greenhouse] ${slug}: HTTP ${res.status}`);
        await sleep(DELAY_MS);
        continue;
      }

      const data = await res.json();
      const listings = data.jobs || [];

      for (const job of listings) {
        const location = job.location?.name || '';
        const desc = stripHtml(job.content || '');

        jobs.push({
          source: 'greenhouse',
          external_id: String(job.id),
          title: job.title,
          company,
          company_domain: domain,
          description: desc.slice(0, 8000),
          requirements: [],
          location,
          remote_type: detectRemote(location),
          apply_url: job.absolute_url,
          apply_type: 'greenhouse',
          department: job.departments?.[0]?.name || null,
          company_stage: 'unknown',
          posted_at: job.updated_at || null,
          salary_min: null,
          salary_max: null,
          salary_currency: 'USD',
          description_hash: makeDescHash(company, job.title, desc),
        });
      }

      await sleep(DELAY_MS);
    } catch (err) {
      // Per-company error — log and continue, don't abort the whole scrape
      console.warn(`[greenhouse] ${slug}: ${err.message}`);
    }
  }

  console.log(`[greenhouse] scraped ${jobs.length} jobs`);
  return jobs;
}
