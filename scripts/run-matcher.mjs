/**
 * Standalone matcher runner — for GitHub Actions.
 *
 * Scores unmatched jobs for all active users.
 * Equivalent to GET /api/cron/match-jobs but:
 *   - No Vercel 10s timeout
 *   - Processes ALL active users (not capped at 10)
 *   - Up to 300 jobs per user scored with Claude Haiku
 *
 * Usage (from repo root):
 *   node scripts/run-matcher.mjs
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Validate required env vars
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[run-matcher] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('[run-matcher] Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

// Import match utilities — match.js uses only relative imports + @anthropic-ai/sdk (no @/ aliases)
const __dirname = dirname(fileURLToPath(import.meta.url));
const { buildCandidateSummary, makeProfileHash, scoreBatch } = await import(
  resolve(__dirname, '../src/lib/ai/match.js')
);

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Constants (mirrors match-jobs/route.js) ───────────────────────────────────

const BATCH_SIZE        = 50;   // jobs per Claude call
const MAX_JOBS_PER_USER = 300;  // unmatched jobs to process per user
const INACTIVE_DAYS     = 2;    // skip users inactive longer than this
const JOB_SELECT = 'id, title, company, company_domain, location, remote_type, company_stage, department, description, apply_url, apply_type, salary_min, salary_max, salary_currency, posted_at';

const REMOTE_FILTERS = {
  remote_only: ['remote'],
  hybrid:      ['remote', 'hybrid'],
  onsite_ok:   ['remote', 'hybrid', 'onsite'],
  open:        ['remote', 'hybrid', 'onsite'],
};

const ROLE_STOPWORDS = new Set([
  'manager', 'director', 'senior', 'lead', 'head', 'junior', 'associate',
  'principal', 'vice', 'chief', 'officer', 'specialist', 'analyst', 'executive',
  'and', 'of', 'the', 'for', 'at', 'with',
]);

function buildRoleKeywords(targetRoles = []) {
  if (!targetRoles?.length) return [];
  const words = new Set();
  for (const role of targetRoles) {
    for (const word of role.toLowerCase().split(/\s+/)) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean.length > 3 && !ROLE_STOPWORDS.has(clean)) words.add(clean);
    }
  }
  return [...words].slice(0, 5);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('[run-matcher] starting...');
const startedAt = Date.now();

// Fetch all users with completed onboarding, most-recently-active first
const { data: users, error: usersError } = await supabase
  .from('users')
  .select('id, locations, remote_pref, ic_or_lead, company_stage, last_active_at, target_roles')
  .eq('onboarding_completed', true)
  .order('last_active_at', { ascending: false, nullsFirst: false })
  .limit(500); // safety cap — 500 users is ~500 × 30 Claude calls per user

if (usersError) {
  console.error('[run-matcher] failed to fetch users:', usersError.message);
  process.exit(1);
}

if (!users?.length) {
  console.log('[run-matcher] no active users to match');
  process.exit(0);
}

// Filter out inactive users (no activity in last INACTIVE_DAYS)
const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
const activeUsers = users.filter(u => u.last_active_at && u.last_active_at >= cutoff);
const skippedCount = users.length - activeUsers.length;
if (skippedCount > 0) {
  console.log(`[run-matcher] skipping ${skippedCount} inactive users (no activity in ${INACTIVE_DAYS}d)`);
}

if (!activeUsers.length) {
  console.log('[run-matcher] no active users to match');
  process.exit(0);
}

console.log(`[run-matcher] processing ${activeUsers.length} active users...`);

let totalScored = 0;
let totalErrors = 0;
const results = {};

for (const user of activeUsers) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('parsed_json')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .maybeSingle();

    if (!profile?.parsed_json) {
      results[user.id] = { skipped: 'no_profile' };
      continue;
    }

    const profileHash = makeProfileHash(profile.parsed_json);
    const candidate   = buildCandidateSummary(profile, user);

    // Job IDs already scored for this profile version
    const { data: existingMatches } = await supabase
      .from('job_matches')
      .select('job_id')
      .eq('user_id', user.id)
      .eq('profile_hash', profileHash);

    const matchedIds = new Set((existingMatches || []).map((r) => r.job_id));

    const remoteFilter = REMOTE_FILTERS[user.remote_pref] || REMOTE_FILTERS.open;
    const roleKeywords = buildRoleKeywords(user.target_roles);
    const fetchLimit   = MAX_JOBS_PER_USER + matchedIds.size;

    let jobs = [];
    if (roleKeywords.length > 0) {
      const orFilter = roleKeywords.map((w) => `title.ilike.%${w}%`).join(',');
      const { data } = await supabase
        .from('jobs')
        .select(JOB_SELECT)
        .eq('is_active', true)
        .in('remote_type', remoteFilter)
        .or(orFilter)
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(fetchLimit);
      jobs = data || [];
    }

    if (jobs.length < 10) {
      const { data } = await supabase
        .from('jobs')
        .select(JOB_SELECT)
        .eq('is_active', true)
        .in('remote_type', remoteFilter)
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(fetchLimit);
      jobs = data || [];
    }

    const unmatched = jobs.filter((j) => !matchedIds.has(j.id)).slice(0, MAX_JOBS_PER_USER);

    if (!unmatched.length) {
      results[user.id] = { skipped: 'all_matched', existing: matchedIds.size };
      continue;
    }

    let scored = 0, errors = 0;

    for (let i = 0; i < unmatched.length; i += BATCH_SIZE) {
      const batch = unmatched.slice(i, i + BATCH_SIZE);
      try {
        const scores = await scoreBatch(candidate, batch);

        const matchRecords = batch.map((job, idx) => ({
          user_id:       user.id,
          job_id:        job.id,
          match_score:   Math.round(scores[idx]?.score ?? 0),
          match_reasons: scores[idx]?.match_reasons ?? [],
          gap_analysis:  scores[idx]?.gap_analysis ?? [],
          profile_hash:  profileHash,
          status:        'pending',
          scored_at:     new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('job_matches')
          .upsert(matchRecords, { onConflict: 'user_id,job_id' });

        if (error) { console.error(`[run-matcher] upsert error:`, error.message); errors += batch.length; }
        else scored += batch.length;
      } catch (err) {
        console.error(`[run-matcher] batch error for user ${user.id}:`, err.message);
        errors += batch.length;
      }
    }

    results[user.id] = { processed: unmatched.length, scored, errors };
    totalScored += scored;
    totalErrors += errors;

    console.log(`[run-matcher] user ${user.id}: scored ${scored}/${unmatched.length}`);
  } catch (err) {
    console.error(`[run-matcher] user ${user.id}:`, err.message);
    results[user.id] = { error: err.message };
  }
}

const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`[run-matcher] done in ${durationSec}s — ${totalScored} total matches scored, ${totalErrors} errors`);
