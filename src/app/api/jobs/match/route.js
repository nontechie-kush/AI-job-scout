/**
 * POST /api/jobs/match
 *
 * On-demand matching trigger — called from onboarding save-preferences.
 * Returns immediately with { status: 'matching_started' }.
 * Actual scoring runs in the background via runInitialMatch().
 *
 * Matching flow:
 *   1. Build role keywords from user.target_roles + profile.title
 *   2. Query DB for role-relevant jobs (title ILIKE %keyword%)
 *   3. If pool < 10 → trigger on-demand Naukri fetch for this user (5 clusters, ~8s)
 *   4. Score up to 60 relevant jobs (6 batches of 10 with Claude Haiku)
 *
 * This ensures new users with niche functions (Marketing, Finance, Design)
 * get real matches even before the 4h cron runs.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildCandidateSummary, makeProfileHash, scoreBatch } from '@/lib/ai/match';

export const maxDuration = 300;

const INITIAL_BATCH = 10;  // score up to this many jobs at signup — fits Vercel Hobby 10s limit
const REFRESH_BATCH = 50;  // user-initiated "find more jobs" — 1 Haiku call, skip already-scored
const JOB_SELECT = 'id, title, company, company_domain, location, remote_type, company_stage, department, description, apply_url, apply_type, salary_min, salary_max, salary_currency, posted_at';

// Stopwords that don't carry job function signal
const ROLE_STOPWORDS = new Set([
  'manager', 'director', 'senior', 'lead', 'head', 'junior', 'associate',
  'principal', 'vice', 'chief', 'officer', 'specialist', 'analyst', 'executive',
  'and', 'of', 'the', 'for', 'at', 'with',
]);

// remote_type values allowed per user's remote_pref
const REMOTE_FILTERS = {
  remote_only: ['remote'],
  hybrid:      ['remote', 'hybrid'],
  onsite_ok:   ['remote', 'hybrid', 'onsite'],
  open:        ['remote', 'hybrid', 'onsite'],
};

export async function POST(request) {
  try {
    let userId;

    // Allow service-to-service call (from save-preferences) with user_id in body
    const authHeader = request.headers.get('authorization');
    const isServiceCall = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let mode = 'initial';
    if (isServiceCall) {
      const body = await request.json().catch(() => ({}));
      userId = body.user_id;
      mode = body.mode || 'initial';
      if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    } else {
      const supabase = await createClientFromRequest(request);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      userId = user.id;
      const body = await request.json().catch(() => ({}));
      mode = body.mode || 'initial';
    }

    const scored = await runInitialMatch(userId, mode === 'refresh' ? REFRESH_BATCH : INITIAL_BATCH);

    return NextResponse.json({ status: 'matching_done', scored: scored || 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract function keywords for DB pre-filtering.
 * Uses ONLY target_roles (explicit user intent) — never CV content.
 *
 * CV keywords like "engagement", "finance", "strategy" are intentionally excluded
 * because they cause cross-function false positives in the job query.
 *
 * 'Marketing Manager' + 'Growth Manager' → ['marketing', 'growth']
 * 'Product Manager'                      → ['product']
 * 'Software Engineer'                    → ['software', 'engineer']
 */
function buildRoleKeywords(targetRoles = []) {
  if (!targetRoles?.length) return [];

  const words = new Set();
  for (const role of targetRoles) {
    for (const word of role.toLowerCase().split(/\s+/)) {
      const clean = word.replace(/[^a-z]/g, ''); // strip punctuation / parens
      if (clean.length > 3 && !ROLE_STOPWORDS.has(clean)) {
        words.add(clean);
      }
    }
  }
  return [...words].slice(0, 5);
}

/**
 * Location hard filter: jobs in user's locations → any work style;
 * jobs outside user's locations → only remote.
 *
 * "India" user seeing on-site USA jobs was the bug this fixes.
 */
function applyLocationFilter(jobs, userLocations) {
  if (!userLocations?.length) return jobs;
  const locs = userLocations.map((l) => l.toLowerCase());

  return jobs.filter((job) => {
    if (job.remote_type === 'remote') return true;
    const jobLoc = (job.location || '').toLowerCase();
    return locs.some((loc) => jobLoc.includes(loc));
  });
}

/**
 * Query jobs whose title contains any of the role keywords.
 * Filters by remote_type to match user's work style preference,
 * then applies location hard filter.
 * Falls back to most-recent jobs if keywords yield < 10 results.
 */
async function fetchRelevantJobs(supabase, roleKeywords, limit, remotePref, userLocations) {
  const remoteFilter = REMOTE_FILTERS[remotePref] || REMOTE_FILTERS.open;
  // Fetch extra to account for location filtering
  const fetchLimit = limit * 3;

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

    const filtered = applyLocationFilter(data || [], userLocations);
    if (filtered.length >= 10) return filtered.slice(0, limit);
    console.log(`[match/trigger] ${filtered.length} role-relevant jobs after location filter (${roleKeywords.join(', ')}, remote_pref=${remotePref})`);
  }

  // Generic fallback — still respects remote_pref + location filter
  const { data } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('is_active', true)
    .in('remote_type', remoteFilter)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  return applyLocationFilter(data || [], userLocations).slice(0, limit);
}

// ── Core matching function ────────────────────────────────────────────────────

async function runInitialMatch(userId, maxJobs = INITIAL_BATCH) {
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // Fetch profile + user prefs — include target_roles
  const [{ data: profile }, { data: userRow }] = await Promise.all([
    supabase
      .from('profiles')
      .select('parsed_json')
      .eq('user_id', userId)
      .order('parsed_at', { ascending: false })
      .maybeSingle(),
    supabase
      .from('users')
      .select('locations, remote_pref, ic_or_lead, company_stage, target_roles')
      .eq('id', userId)
      .single(),
  ]);

  if (!profile?.parsed_json || !userRow) return 0;

  const candidate   = buildCandidateSummary(profile, userRow);
  const profileHash = makeProfileHash(profile.parsed_json);
  // Only use explicit target_roles for keyword search — not CV content
  const roleKeywords = buildRoleKeywords(userRow.target_roles);

  // Fetch role-relevant jobs from existing DB, filtered by user's remote_pref + location
  const jobs = await fetchRelevantJobs(supabase, roleKeywords, maxJobs, userRow.remote_pref, userRow.locations);

  // India users: always include recent Naukri jobs in the scoring pool.
  // fetchRelevantJobs may return 60 keyword-matched Greenhouse/Lever jobs and stop —
  // Naukri jobs (different title formats) never enter the pool otherwise.
  const targetsIndia = (userRow.locations || []).some((l) => l.toLowerCase() === 'india');
  if (targetsIndia) {
    const naukriSelect = 'id, title, company, company_domain, location, remote_type, company_stage, department, description, apply_url, apply_type, salary_min, salary_max, salary_currency, posted_at, source';
    const remoteFilter = REMOTE_FILTERS[userRow.remote_pref] || REMOTE_FILTERS.open;
    const { data: naukriJobs } = await supabase
      .from('jobs')
      .select(naukriSelect)
      .eq('is_active', true)
      .eq('source', 'naukri')
      .in('remote_type', remoteFilter)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(40);

    if (naukriJobs?.length) {
      const existingIds = new Set(jobs.map((j) => j.id));
      for (const j of naukriJobs) {
        if (!existingIds.has(j.id)) jobs.push(j);
      }
      console.log(`[match/trigger] added ${naukriJobs.length} Naukri jobs to pool for India user (total pool: ${jobs.length})`);
    }
  }

  // Skip jobs already scored for this profile version
  const { data: existingMatches } = await supabase
    .from('job_matches')
    .select('job_id')
    .eq('user_id', userId)
    .eq('profile_hash', profileHash);
  const matchedIds = new Set((existingMatches || []).map((r) => r.job_id));

  const jobsToScore = jobs.filter((j) => !matchedIds.has(j.id)).slice(0, maxJobs);
  if (!jobsToScore.length) return 0;

  // Score in batches of 50
  const BATCH = 50;
  const matchRecords = [];

  for (let i = 0; i < jobsToScore.length; i += BATCH) {
    const batch = jobsToScore.slice(i, i + BATCH);
    try {
      const scores = await scoreBatch(candidate, batch);
      batch.forEach((job, idx) => {
        matchRecords.push({
          user_id:       userId,
          job_id:        job.id,
          match_score:   Math.round(scores[idx]?.score ?? 0),
          match_reasons: scores[idx]?.match_reasons ?? [],
          gap_analysis:  scores[idx]?.gap_analysis ?? [],
          profile_hash:  profileHash,
          status:        'pending',
          scored_at:     new Date().toISOString(),
        });
      });
    } catch (err) {
      console.error('[match/trigger] batch error:', err.message);
    }
  }

  if (matchRecords.length) {
    const { error: upsertErr } = await supabase.from('job_matches').upsert(matchRecords, { onConflict: 'user_id,job_id' });
    if (upsertErr) console.error('[match/trigger] upsert error:', upsertErr.message);
  }

  const goodMatches = matchRecords.filter((r) => r.match_score >= 40).length;
  console.log(`[match/trigger] scored ${matchRecords.length} jobs, ${goodMatches} passed intent gate (${roleKeywords.join(', ')})`);
  return matchRecords.length;
}
