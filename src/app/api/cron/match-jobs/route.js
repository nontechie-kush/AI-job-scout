/**
 * GET /api/cron/match-jobs
 *
 * Vercel Cron — runs every hour.
 * Scores unmatched jobs for recently-active users.
 *
 * Strategy:
 *   - Process up to MAX_USERS_PER_RUN users (most-recently-active first)
 *   - Per user: pre-filter jobs by remote_pref, then score in batches of BATCH_SIZE
 *   - Skip jobs already scored with same profile_hash (profile hasn't changed)
 *   - Upsert into job_matches table
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { buildCandidateSummary, makeProfileHash, scoreBatch } from '@/lib/ai/match';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 50;         // jobs per Claude call
const MAX_JOBS_PER_USER = 300; // unmatched jobs to process per run (keyword-filtered pool)
const MAX_USERS_PER_RUN = 10;  // users per cron invocation
const INACTIVE_DAYS = 2;       // skip users inactive longer than this

// Schema: remote_pref IN ('remote_only','hybrid','onsite_ok','open')
const REMOTE_FILTERS = {
  remote_only: ['remote'],
  hybrid: ['remote', 'hybrid'],
  onsite_ok: ['remote', 'hybrid', 'onsite'],
  open: ['remote', 'hybrid', 'onsite'],
};

// Stopwords that don't carry job function signal (same as match/route.js)
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

/**
 * Location hard filter: jobs in user's locations → any work style;
 * jobs outside user's locations → only remote.
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

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const results = {};

  // Get most recently active users with completed onboarding
  const { data: users } = await supabase
    .from('users')
    .select('id, locations, remote_pref, ic_or_lead, company_stage, last_active_at, target_roles')
    .eq('onboarding_completed', true)
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .limit(MAX_USERS_PER_RUN);

  if (!users?.length) {
    return NextResponse.json({ message: 'No active users to match', duration_ms: Date.now() - startedAt });
  }

  // Filter out inactive users (no activity in last INACTIVE_DAYS)
  const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const activeUsers = users.filter(u => u.last_active_at && u.last_active_at >= cutoff);
  const skippedCount = users.length - activeUsers.length;
  if (skippedCount > 0) {
    console.log(`[match-jobs] skipping ${skippedCount} inactive users (no activity in ${INACTIVE_DAYS}d)`);
  }

  if (!activeUsers.length) {
    return NextResponse.json({ message: 'No active users to match', skipped_inactive: skippedCount, duration_ms: Date.now() - startedAt });
  }

  for (const user of activeUsers) {
    try {
      // Get latest profile
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
      const candidate = buildCandidateSummary(profile, user);

      // Get job IDs already matched for this profile version
      const { data: existingMatches } = await supabase
        .from('job_matches')
        .select('job_id')
        .eq('user_id', user.id)
        .eq('profile_hash', profileHash);

      const matchedIds = new Set((existingMatches || []).map((r) => r.job_id));

      // Pre-filter jobs by remote preference + role keywords
      const remoteFilter = REMOTE_FILTERS[user.remote_pref] || REMOTE_FILTERS.open;
      const roleKeywords = buildRoleKeywords(user.target_roles);
      const JOB_SELECT = 'id, title, company, company_domain, location, remote_type, company_stage, department, description, apply_url, apply_type, salary_min, salary_max, salary_currency, posted_at';
      const fetchLimit = MAX_JOBS_PER_USER + matchedIds.size;

      // Fetch extra to account for location filtering
      const locationFetchLimit = fetchLimit * 3;
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
          .limit(locationFetchLimit);
        jobs = applyLocationFilter(data || [], user.locations);
      }

      // Fallback: if no keywords or too few results, fetch most recent
      if (jobs.length < 10) {
        const { data } = await supabase
          .from('jobs')
          .select(JOB_SELECT)
          .eq('is_active', true)
          .in('remote_type', remoteFilter)
          .order('posted_at', { ascending: false, nullsFirst: false })
          .limit(locationFetchLimit);
        jobs = applyLocationFilter(data || [], user.locations);
      }

      const unmatched = jobs
        .filter((j) => !matchedIds.has(j.id))
        .slice(0, MAX_JOBS_PER_USER);

      if (!unmatched.length) {
        results[user.id] = { skipped: 'all_matched', existing: matchedIds.size };
        continue;
      }

      // Score in batches
      let scored = 0, errors = 0;

      for (let i = 0; i < unmatched.length; i += BATCH_SIZE) {
        const batch = unmatched.slice(i, i + BATCH_SIZE);
        try {
          const scores = await scoreBatch(candidate, batch);

          const matchRecords = batch.map((job, idx) => ({
            user_id: user.id,
            job_id: job.id,
            match_score: Math.round(scores[idx]?.score ?? 0),
            match_reasons: scores[idx]?.match_reasons ?? [],
            gap_analysis: scores[idx]?.gap_analysis ?? [],
            profile_hash: profileHash,
            status: 'pending',
            scored_at: new Date().toISOString(),
          }));

          const { error } = await supabase
            .from('job_matches')
            .upsert(matchRecords, { onConflict: 'user_id,job_id' });

          if (error) { console.error(`[match-jobs] upsert error:`, error.message); errors += batch.length; }
          else scored += batch.length;
        } catch (err) {
          console.error(`[match-jobs] batch error for ${user.id}:`, err.message);
          errors += batch.length;
        }
      }

      results[user.id] = { processed: unmatched.length, scored, errors };
    } catch (err) {
      console.error(`[match-jobs] user ${user.id}:`, err.message);
      results[user.id] = { error: err.message };
    }
  }

  const totalScored = Object.values(results).reduce((s, r) => s + (r.scored || 0), 0);
  console.log(`[match-jobs] done — ${totalScored} matches scored in ${Date.now() - startedAt}ms`);

  return NextResponse.json({
    duration_ms: Date.now() - startedAt,
    users_processed: Object.keys(results).length,
    skipped_inactive: skippedCount,
    total_scored: totalScored,
    results,
  });
}
