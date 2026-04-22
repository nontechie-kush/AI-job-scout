/**
 * POST /api/fetch-jd
 *
 * Fetches and extracts a job description from a URL.
 * Supports: LinkedIn, Naukri, Greenhouse, Lever, Ashby, Cutshort, generic pages.
 *
 * Strategy:
 *   1. Detect board from URL → use board-specific extraction
 *   2. Direct fetch + cheerio for most boards
 *   3. ScraperAPI (render=true) fallback for JS-heavy pages (LinkedIn, Naukri)
 *   4. Haiku cleans raw text → structured { title, company, description }
 *
 * Body: { url: string }
 * Returns: { title, company, description, source: 'scraped' | 'needs_paste' }
 */

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Board detection ───────────────────────────────────────────────────────────

function detectBoard(url) {
  if (/linkedin\.com\/jobs/i.test(url)) return 'linkedin';
  if (/naukri\.com/i.test(url)) return 'naukri';
  if (/greenhouse\.io|boards\.greenhouse/i.test(url)) return 'greenhouse';
  if (/lever\.co/i.test(url)) return 'lever';
  if (/ashbyhq\.com/i.test(url)) return 'ashby';
  if (/cutshort\.io/i.test(url)) return 'cutshort';
  if (/wellfound\.com/i.test(url)) return 'wellfound';
  if (/instahyre\.com/i.test(url)) return 'instahyre';
  if (/internshala\.com/i.test(url)) return 'internshala';
  if (/foundit\.in|monster\.com/i.test(url)) return 'foundit';
  return 'generic';
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function directFetch(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function scraperApiFetch(url, render = false, countryCode = '') {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key || key === 'placeholder') throw new Error('ScraperAPI not configured');
  const country = countryCode ? `&country_code=${countryCode}` : '';
  const apiUrl = `https://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}${render ? '&render=true' : ''}${country}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`ScraperAPI ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Board-specific extractors ─────────────────────────────────────────────────

function extractGreenhouse(html) {
  const $ = cheerio.load(html);
  const title = $('h1.app-title, h1[class*="posting-headline"], h1').first().text().trim();
  const company = $('.company-name, [class*="company"]').first().text().trim();
  const description = $('#content, .job__description, [class*="description"]').first().text().trim();
  return { title, company, description };
}

function extractLever(html) {
  const $ = cheerio.load(html);
  const title = $('h2[data-qa="posting-name"], .posting-headline h2, h2').first().text().trim();
  const company = $('title').text().split(' at ').pop()?.split(' - ')[0]?.trim() || '';
  const description = $('.section-wrapper, [class*="posting-description"]').text().trim();
  return { title, company, description };
}

function extractAshby(html) {
  const $ = cheerio.load(html);
  // Ashby uses __NEXT_DATA__
  try {
    const raw = $('#__NEXT_DATA__').html();
    if (raw) {
      const data = JSON.parse(raw);
      const job = data?.props?.pageProps?.jobPosting || data?.props?.pageProps?.job;
      if (job) {
        return {
          title: job.title || '',
          company: job.organizationName || job.organization?.name || '',
          description: job.descriptionPlain || job.jobPostingDescription || '',
        };
      }
    }
  } catch {}
  const title = $('h1').first().text().trim();
  const description = $('[class*="description"], main').text().trim();
  return { title, company: '', description };
}

function extractCutshort(html) {
  const $ = cheerio.load(html);
  try {
    const raw = $('#__NEXT_DATA__').html();
    if (raw) {
      const data = JSON.parse(raw);
      const queries = data?.props?.pageProps?.dehydratedState?.queries || [];
      for (const q of queries) {
        const job = q?.state?.data?.data;
        if (job?.title) {
          return {
            title: job.title || '',
            company: job.organization?.name || '',
            description: [job.description, job.skills?.join(', ')].filter(Boolean).join('\n\n'),
          };
        }
      }
    }
  } catch {}
  const title = $('h1').first().text().trim();
  const description = $('[class*="description"], .job-detail').text().trim();
  return { title, company: '', description };
}

function extractGeneric(html) {
  const $ = cheerio.load(html);

  // Try JSON-LD first (before removing scripts)
  try {
    const jsonLd = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get();
    for (const raw of jsonLd) {
      const data = JSON.parse(raw);
      if (data['@type'] === 'JobPosting') {
        return {
          title: data.title || '',
          company: data.hiringOrganization?.name || '',
          description: data.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '',
        };
      }
    }
  } catch {}

  // Remove nav, header, footer, scripts, styles before text extraction
  $('nav, header, footer, script, style, [class*="nav"], [class*="header"], [class*="footer"], [class*="sidebar"], [class*="cookie"], [class*="banner"]').remove();

  const title = $('h1').first().text().trim();
  const description = $('main, article, [class*="job"], [class*="description"], [id*="job"], [id*="description"]')
    .first().text().replace(/\s+/g, ' ').trim();
  return { title, company: '', description: description || $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000) };
}

// ── Haiku cleanup ─────────────────────────────────────────────────────────────

async function cleanWithHaiku(raw, url) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    temperature: 0,
    system: `Extract the job posting details from this raw text. Output ONLY valid JSON:
{
  "title": "<job title>",
  "company": "<company name>",
  "description": "<clean job description — responsibilities, requirements, about the role. Remove boilerplate like cookie notices, nav text, ads. Keep 200-800 words.>"
}
If this is not a job posting, output: {"not_a_job": true}`,
    messages: [{ role: 'user', content: `URL: ${url}\n\nRaw text:\n${raw.slice(0, 6000)}` }],
  });

  const text = msg.content[0].text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(text);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });

    const board = detectBoard(url);
    console.log('[fetch-jd] board:', board, 'url:', url);

    let extracted = null;

    // ── Board-specific fast path ──────────────────────────────────────────────
    try {
      if (board === 'greenhouse') {
        const html = await directFetch(url);
        extracted = extractGreenhouse(html);
      } else if (board === 'lever') {
        const html = await directFetch(url);
        extracted = extractLever(html);
      } else if (board === 'ashby') {
        const html = await directFetch(url);
        extracted = extractAshby(html);
      } else if (board === 'cutshort') {
        const html = await directFetch(url);
        extracted = extractCutshort(html);
      } else if (board === 'linkedin' || board === 'wellfound') {
        // JS-heavy — need render=true for full content
        const html = await scraperApiFetch(url, true);
        extracted = extractGeneric(html);
      } else if (board === 'naukri' || board === 'instahyre' || board === 'internshala' || board === 'foundit') {
        // These sites block automated access even with JS rendering — fast-fail to paste
        return NextResponse.json({
          source: 'needs_paste',
          reason: `${board.charAt(0).toUpperCase() + board.slice(1)} blocks automated access. Open the job page, copy the description, and paste it below.`,
        });
      } else {
        // Generic: try direct first, fall back to ScraperAPI
        try {
          const html = await directFetch(url);
          extracted = extractGeneric(html);
        } catch {
          const html = await scraperApiFetch(url, false);
          extracted = extractGeneric(html);
        }
      }
    } catch (err) {
      console.warn('[fetch-jd] extraction failed:', err.message);
    }

    // ── If extraction got something, clean with Haiku ─────────────────────────
    if (extracted?.description && extracted.description.length > 100) {
      const raw = [extracted.title, extracted.company, extracted.description].filter(Boolean).join('\n\n');
      try {
        const cleaned = await cleanWithHaiku(raw, url);
        if (cleaned.not_a_job) {
          return NextResponse.json({ source: 'needs_paste', reason: 'URL does not appear to be a job posting' });
        }
        return NextResponse.json({
          source: 'scraped',
          title: cleaned.title || extracted.title || '',
          company: cleaned.company || extracted.company || '',
          description: cleaned.description || extracted.description || '',
        });
      } catch {
        // Haiku failed — return raw extraction
        return NextResponse.json({
          source: 'scraped',
          title: extracted.title || '',
          company: extracted.company || '',
          description: extracted.description || '',
        });
      }
    }

    // ── Nothing extracted — ask user to paste ─────────────────────────────────
    return NextResponse.json({
      source: 'needs_paste',
      reason: 'Could not extract job description from this URL',
    });

  } catch (err) {
    console.error('[fetch-jd]', err);
    // Don't 500 — tell the client to show the paste fallback
    return NextResponse.json({
      source: 'needs_paste',
      reason: err.message,
    });
  }
}
