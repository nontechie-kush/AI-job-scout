/**
 * POST /api/rolepitch/enrich-profile
 *
 * Scrapes one or more URLs (LinkedIn, GitHub, portfolio, Framer, HuggingFace, etc.)
 * and returns concatenated plain text for use as additionalContext in parse-resume.
 *
 * Body: { urls: string[] }
 * Returns: { text: string, sources: { url, status, chars }[] }
 *
 * Unauthenticated — scraping is safe, no PII stored here.
 */

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_URLS = 5;
const TIMEOUT_MS = 8000;
const MAX_CHARS_PER_URL = 6000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function detectType(url) {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com/in/')) return 'linkedin';
  if (u.includes('github.com/') && !u.includes('/repos') && !u.includes('/blob')) return 'github';
  if (u.includes('huggingface.co/')) return 'huggingface';
  return 'web';
}

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// GitHub: use public API to get profile + pinned repos bio
async function scrapeGitHub(url) {
  const match = url.match(/github\.com\/([^/?\s]+)/i);
  if (!match) return null;
  const username = match[1];

  const [userRes, reposRes] = await Promise.all([
    fetchWithTimeout(`https://api.github.com/users/${username}`),
    fetchWithTimeout(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`),
  ]);

  if (!userRes.ok) return null;
  const user = await userRes.json();
  const repos = reposRes.ok ? await reposRes.json() : [];

  const lines = [
    `GitHub: ${user.name || username}`,
    user.bio ? `Bio: ${user.bio}` : '',
    user.company ? `Company: ${user.company}` : '',
    user.location ? `Location: ${user.location}` : '',
    `Public repos: ${user.public_repos}`,
    '',
    'Top repositories:',
    ...repos.slice(0, 8).map(r =>
      `- ${r.name}${r.description ? ': ' + r.description : ''} [${r.language || 'N/A'}] ★${r.stargazers_count}`
    ),
  ];
  return lines.filter(Boolean).join('\n');
}

// Generic HTML scrape — extract readable text via cheerio
async function scrapeWeb(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, header, footer, iframe, noscript, [aria-hidden="true"]').remove();

  // Try semantic content areas first
  const selectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];
  let text = '';
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      text = el.text();
      if (text.trim().length > 200) break;
    }
  }

  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS_PER_URL);
}

async function scrapeUrl(url) {
  try {
    const type = detectType(url);
    let text = null;

    if (type === 'github') {
      text = await scrapeGitHub(url);
    } else {
      // For LinkedIn, HuggingFace, Framer, portfolio sites — all use cheerio
      // LinkedIn public pages return some content without auth
      text = await scrapeWeb(url);
    }

    if (!text || text.trim().length < 50) {
      return { url, status: 'empty', text: '', chars: 0 };
    }

    const trimmed = text.slice(0, MAX_CHARS_PER_URL);
    return { url, status: 'ok', text: trimmed, chars: trimmed.length };
  } catch (err) {
    console.warn('[enrich-profile] scrape failed:', url, err.message);
    return { url, status: 'error', text: '', chars: 0 };
  }
}

export async function POST(request) {
  try {
    const { urls } = await request.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array required' }, { status: 400 });
    }

    const dedupedUrls = [...new Set(urls.filter(u => typeof u === 'string' && u.startsWith('http')))].slice(0, MAX_URLS);

    // Scrape all in parallel
    const results = await Promise.all(dedupedUrls.map(scrapeUrl));

    const sources = results.map(r => ({ url: r.url, status: r.status, chars: r.chars }));
    const combined = results
      .filter(r => r.text)
      .map(r => `\n\n--- From ${r.url} ---\n${r.text}`)
      .join('');

    return NextResponse.json({ text: combined, sources });
  } catch (err) {
    console.error('[enrich-profile]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
