/**
 * import-recruiters.mjs
 *
 * Converts a PhantomBuster "LinkedIn Search Export" CSV into recruiter records
 * in Supabase. Uses Claude Haiku to classify each recruiter.
 *
 * Usage:
 *   node scripts/import-recruiters.mjs path/to/phantombuster-export.csv
 *
 * PhantomBuster CSV columns used:
 *   profileUrl, fullName, headline, summary, location, company
 *
 * Requires .env.local:
 *   ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ── Load env from .env.local ──────────────────────────────────────────────────
const envFile = fs.readFileSync(
  path.join(process.cwd(), '.env.local'), 'utf8'
);
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ── Parse CSV (proper multiline-safe parser) ──────────────────────────────────

function parseCSV(text) {
  const headers = [];
  const result = [];
  let row = [], cur = '', inQuote = false, headerDone = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      row.push(cur); cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(v => v)) {
        if (!headerDone) { headers.push(...row.map(h => h.trim())); headerDone = true; }
        else result.push(Object.fromEntries(headers.map((h, idx) => [h, (row[idx] || '').trim()])));
      }
      row = [];
    } else {
      cur += ch;
    }
  }
  // last row
  if (cur || row.length) {
    row.push(cur);
    if (row.some(v => v) && headerDone)
      result.push(Object.fromEntries(headers.map((h, idx) => [h, (row[idx] || '').trim()])));
  }
  return result;
}

// ── Clean display name ────────────────────────────────────────────────────────
// Strips: emoji, non-Latin scripts, credential suffixes (SPHR, MBA, SHRM, etc.),
// pronoun tags (SheHer, HeHimHis), job titles that leak into name field.

const NAME_STOP_WORDS = new Set([
  'sphr','gphr','phr','bhr','mba','shrm','cipd','chrl','chrp','pmp','odcp','cphr',
  'chrm','ccrp','gcil','cpp','rpr','cdsp','airs','shrm-scp','shrm-cp',
  'dr','ms','mr','mrs',
  'forbes','hbr','hrd','certified','specialist','recruiter','head','manager',
  'director','lead','senior','junior','associate',
  'connections','techsales','technology','product',
  'j.d.','ll.b','ll.m','ph.d','hon.','jr.','sr.',
]);
const NAME_HONORIFICS = new Set(['dr','dr.','ms','ms.','mr','mr.','mrs','mrs.','prof','prof.']);

function cleanName(raw) {
  if (!raw) return '';
  // Strip non-Latin scripts (Arabic, Chinese, bold Unicode, etc.) — keep Latin extended
  let name = raw.replace(/[^\u0000-\u024F\s\-'.]/g, ' ').replace(/\s+/g, ' ').trim();
  // Split on word-boundary separators only (preserves hyphenated surnames)
  name = name.split(/\s+[-|–—·•]\s+|\s+[|–—·•]\s*/)[0].trim();
  // Handle no-space honorific (Ms.Tamam → "Ms. Tamam")
  name = name.replace(/^(Dr|Ms|Mr|Mrs|Prof)\./i, '$1. ').trim();

  const tokens = name.split(/\s+/);
  const clean = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const tl = t.toLowerCase().replace(/[^a-z]/g, '');
    if (i === 0 && NAME_HONORIFICS.has(t.toLowerCase().replace(/\.$/, ''))) { clean.push(t); continue; }
    if (/^[A-Z]{2}/.test(t) && !/[a-z]/.test(t)) break;                          // all-caps abbrev
    if (/^[A-Z]{3,}[A-Za-z]*$/.test(t) && !/^[A-Z][a-z]/.test(t)) break;         // compound credential smash
    if (NAME_STOP_WORDS.has(tl)) break;
    if (/^(She\/?Her|He\/?Him(\/His)?|They\/?Them|SheHer|HeHim(His)?|TheyThem)/i.test(t)) break;
    if (/^He(Him|Her)|^She(Her)|^They(Them)/i.test(t) && t.length > 8) break;     // long pronoun smash
    if (/^[A-Z]-[A-Z]{2,}$/.test(t)) break;                                       // C-KPI style
    clean.push(t);
    const nameTokens = clean.filter(x => !NAME_HONORIFICS.has(x.toLowerCase().replace(/[^a-z]/g, '')));
    if (nameTokens.length >= 4) break;
  }
  return clean.join(' ').trim();
}

// ── Known recruiting agency patterns ─────────────────────────────────────────

const AGENCY_KEYWORDS = [
  'recruit', 'staffing', 'talent', 'headhunt', 'executive search',
  'placement', 'heidrick', 'korn ferry', 'spencer stuart', 'egon zehnder',
  'manpower', 'randstad', 'teamlease', 'xpheno', 'peoplestrong', 'instahyre',
  'michael page', 'robert half', 'adecco', 'search partners',
];

function isAgency(company) {
  const c = (company || '').toLowerCase();
  return AGENCY_KEYWORDS.some(k => c.includes(k));
}

// ── Location → geography + cities ────────────────────────────────────────────

function parseLocation(location) {
  const l = (location || '').toLowerCase();
  const geography = [];
  const cities = [];

  if (l.includes('india') || l.includes('bangalore') || l.includes('bengaluru') ||
      l.includes('mumbai') || l.includes('delhi') || l.includes('hyderabad') ||
      l.includes('pune') || l.includes('chennai') || l.includes('gurgaon')) {
    geography.push('india');
  }
  if (l.includes('united states') || l.includes(', us') || l.includes(', ca') ||
      l.includes('new york') || l.includes('san francisco') || l.includes('seattle') ||
      l.includes('austin') || l.includes('chicago') || l.includes('boston')) {
    geography.push('us');
  }
  if (l.includes('canada') || l.includes('toronto') || l.includes('vancouver')) {
    geography.push('canada');
  }
  if (l.includes('remote') || l.includes('global')) geography.push('global');
  if (!geography.length) geography.push('global');

  const CITY_MAP = {
    'bangalore': 'bangalore', 'bengaluru': 'bangalore', 'mumbai': 'mumbai',
    'delhi': 'delhi', 'new delhi': 'delhi', 'gurgaon': 'delhi', 'noida': 'delhi',
    'hyderabad': 'hyderabad', 'pune': 'pune', 'chennai': 'chennai',
    'new york': 'new york', 'san francisco': 'san francisco', 'seattle': 'seattle',
    'toronto': 'toronto', 'vancouver': 'vancouver',
  };
  for (const [key, city] of Object.entries(CITY_MAP)) {
    if (l.includes(key) && !cities.includes(city)) cities.push(city);
  }

  return { geography, cities };
}

// ── Claude Haiku classification ───────────────────────────────────────────────

function parseFollowerCount(val) {
  if (!val) return 0;
  const m = (val + '').match(/([\d.]+)\s*([kKmM]?)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'k') return Math.round(n * 1000);
  if (unit === 'm') return Math.round(n * 1000000);
  return Math.round(n);
}

async function classifyBatch(rows) {
  const input = rows.map((r, i) => `${i + 1}. Title: "${r.headline || r.title || ''}" | Company: "${r.company || ''}" | Summary: "${(r.additionalInfo || r.summary || '').slice(0, 200)}"`).join('\n');

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Classify each recruiter. Return a JSON array with one object per recruiter (same order).

Each object must have:
- "specialization": array from ["pm", "engineering", "design", "leadership", "growth", "general"] — pick 1-3 that match their focus
- "seniority_levels": array from ["junior", "mid", "senior", "lead", "csuite"] — levels they typically recruit for
- "industry_focus": array from ["fintech", "saas", "ecomm", "healthtech", "edtech", "gaming", "general"] — 1-3

Rules:
- If title mentions "product" → pm
- If title mentions "engineer" or "tech" → engineering
- If title mentions "design" or "ux" → design
- If title mentions "senior", "director", "VP", "C-suite", "executive" → add "leadership"
- If title mentions "growth", "marketing" → add "growth"
- Default specialization if unclear: ["general"]
- Seniority: if title says "junior/associate" → junior; "senior/lead/staff/principal" → senior+lead; "director/VP" → lead+csuite; otherwise mid+senior

Recruiters:
${input}

Return ONLY a JSON array, no explanation.`
    }]
  });

  try {
    const text = msg.content[0].text.trim();
    const json = text.startsWith('[') ? text : text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
    return JSON.parse(json);
  } catch {
    // Fallback: return defaults for each row
    return rows.map(() => ({
      specialization: ['general'],
      seniority_levels: ['mid', 'senior'],
      industry_focus: ['general'],
    }));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/import-recruiters.mjs <path-to-csv>');
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Deduplicate by LinkedIn URL
  const seen = new Set();
  const unique = rows.filter(r => {
    const url = r.profileUrl || r.linkedInProfileUrl || r.linkedin_url || '';
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  console.log(`${unique.length} unique profiles after dedup`);

  // Filter: must look like a recruiter
  const recruiterKeywords = ['recruit', 'talent', 'staffing', 'headhunt', 'talent acquisition', 'ta ', 'hr ', 'human resource'];
  const filtered = unique.filter(r => {
    const headline = (r.headline || r.title || '').toLowerCase();
    return recruiterKeywords.some(k => headline.includes(k));
  });
  console.log(`${filtered.length} confirmed recruiter profiles`);

  if (!filtered.length) {
    console.error('No recruiter profiles found — check CSV column names');
    console.log('Available columns:', Object.keys(unique[0] || {}).join(', '));
    process.exit(1);
  }

  // Process in batches of 10 (Claude call + Supabase insert)
  const BATCH = 10;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < filtered.length; i += BATCH) {
    const batch = filtered.slice(i, i + BATCH);
    console.log(`\nClassifying batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(filtered.length / BATCH)}...`);

    let classifications;
    try {
      classifications = await classifyBatch(batch);
    } catch (err) {
      console.warn('  Claude error:', err.message, '— using defaults');
      classifications = batch.map(() => ({
        specialization: ['general'],
        seniority_levels: ['mid', 'senior'],
        industry_focus: ['general'],
      }));
    }

    const records = batch.map((row, idx) => {
      const cls = classifications[idx] || {};
      const url = row.profileUrl || row.linkedInProfileUrl || '';
      const name = cleanName(row.fullName || `${row.firstName || ''} ${row.lastName || ''}`).trim();
      const company = row.company || row.companyName || '';
      const headline = row.headline || row.title || '';
      const location = row.location || '';
      const { geography, cities } = parseLocation(location);

      return {
        name,
        linkedin_url: url,
        current_company: company,
        title: headline,
        type: isAgency(company) ? 'agency' : 'inhouse',
        specialization: cls.specialization || ['general'],
        seniority_levels: cls.seniority_levels || ['mid', 'senior'],
        industry_focus: cls.industry_focus || ['general'],
        geography,
        cities,
        follower_count: parseFollowerCount(row.sharedConnections || row.followersCount || row.follower_count || '0'),
        email: row.mailFromLinkedIn || row.email || null,
        bio: (row.additionalInfo || '').slice(0, 2000) || null,
        location: row.location || null,
        school: row.school || null,
        school_degree: row.schoolDegree || null,
        response_rate: null,
        avg_reply_days: null,
        placements_at: [row.company2].filter(Boolean),
        manually_curated: false,
        notes: null,
      };
    }).filter(r => r.name && r.linkedin_url);

    if (!records.length) { skipped += batch.length; continue; }

    const { data, error } = await supabase
      .from('recruiters')
      .upsert(records, { onConflict: 'linkedin_url', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('  Supabase error:', error.message);
      skipped += records.length;
    } else {
      inserted += data?.length || 0;
      console.log(`  Inserted ${data?.length || 0} recruiters`);
    }

    // Rate limit: 1 Claude call/second
    if (i + BATCH < filtered.length) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped: ${skipped}`);
}

main().catch(err => { console.error(err); process.exit(1); });
