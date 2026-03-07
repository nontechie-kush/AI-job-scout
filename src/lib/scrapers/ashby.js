/**
 * Ashby scraper — unofficial but stable public API
 * POST https://api.ashbyhq.com/posting-public.list
 * Body: { organizationHostedJobsPageName: "company-slug" }
 *
 * Used by: Anthropic, OpenAI, Linear, Ramp, Vercel, Replit, Scale, Mistral, etc.
 */

import { stripHtml, detectRemote, makeDescHash } from './index';

const COMPANIES = [
  // AI / frontier companies
  ['anthropic', 'Anthropic', 'anthropic.com'],
  ['openai', 'OpenAI', 'openai.com'],
  ['mistral', 'Mistral AI', 'mistral.ai'],
  ['cohere', 'Cohere', 'cohere.com'],
  ['together-ai', 'Together AI', 'together.ai'],
  ['perplexity-ai', 'Perplexity AI', 'perplexity.ai'],
  ['runway', 'Runway ML', 'runwayml.com'],
  ['scale-ai', 'Scale AI', 'scale.com'],
  // Dev tools / infra
  ['replit', 'Replit', 'replit.com'],
  ['linear', 'Linear', 'linear.app'],
  ['vercel', 'Vercel', 'vercel.com'],
  ['cursor', 'Cursor', 'cursor.com'],
  ['posthog', 'PostHog', 'posthog.com'],
  ['graphite', 'Graphite', 'graphite.dev'],
  ['hex', 'Hex', 'hex.tech'],
  ['turso', 'Turso', 'turso.tech'],
  ['resend', 'Resend', 'resend.com'],
  ['raycast', 'Raycast', 'raycast.com'],
  ['warp', 'Warp', 'warp.dev'],
  ['clerk', 'Clerk', 'clerk.com'],
  ['neon', 'Neon', 'neon.tech'],
  ['liveblocks', 'Liveblocks', 'liveblocks.io'],
  ['inngest', 'Inngest', 'inngest.com'],
  ['stytch', 'Stytch', 'stytch.com'],
  ['trigger', 'Trigger.dev', 'trigger.dev'],
  // Fintech / growth
  ['ramp', 'Ramp', 'ramp.com'],
  ['dbt-labs', 'dbt Labs', 'getdbt.com'],
  ['anduril', 'Anduril', 'anduril.com'],
  ['sardine', 'Sardine', 'sardine.ai'],
  // India — modern startups on Ashby
  ['smallcase', 'Smallcase', 'smallcase.com'],
  ['fi-money', 'Fi', 'fi.money'],
  ['setu', 'Setu', 'setu.co'],
  ['jar', 'Jar', 'jar.money'],
];

const ENDPOINT = 'https://api.ashbyhq.com/posting-public.list';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeAshby() {
  const jobs = [];

  for (const [slug, company, domain] of COMPANIES) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CareerPilot/1.0',
        },
        body: JSON.stringify({ organizationHostedJobsPageName: slug }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status !== 404) console.warn(`[ashby] ${slug}: HTTP ${res.status}`);
        await sleep(200);
        continue;
      }

      const data = await res.json();
      const listings = data.results || [];

      for (const job of listings) {
        const location = job.locationName || job.location?.locationStr || '';
        const desc = stripHtml(job.descriptionHtml || '');

        jobs.push({
          source: 'ashby',
          external_id: job.id,
          title: job.title,
          company,
          company_domain: domain,
          description: desc.slice(0, 8000),
          requirements: [],
          location,
          remote_type: detectRemote(`${location} ${job.isRemote ? 'remote' : ''}`),
          apply_url: job.jobUrl || `https://jobs.ashbyhq.com/${slug}/${job.id}`,
          apply_type: 'ashby',
          department: job.department?.name || job.team?.name || null,
          company_stage: 'unknown',
          posted_at: job.publishedAt || null,
          salary_min: job.compensationTierSummary?.minValue ?? null,
          salary_max: job.compensationTierSummary?.maxValue ?? null,
          salary_currency: job.compensationTierSummary?.currency || 'USD',
          description_hash: makeDescHash(company, job.title, desc),
        });
      }

      await sleep(200);
    } catch (err) {
      console.warn(`[ashby] ${slug}: ${err.message}`);
    }
  }

  console.log(`[ashby] scraped ${jobs.length} jobs`);
  return jobs;
}
