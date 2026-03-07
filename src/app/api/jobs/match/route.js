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
import { createClient } from '@/lib/supabase/server';
import { buildCandidateSummary, makeProfileHash, scoreBatch } from '@/lib/ai/match';

export const maxDuration = 300;

const INITIAL_BATCH = 20; // score up to this many jobs on first login
const JOB_SELECT = 'id, title, company, company_domain, location, remote_type, company_stage, department, description, apply_url, apply_type, salary_min, salary_max, salary_currency, posted_at';

// Stopwords that don't carry job function signal
const ROLE_STOPWORDS = new Set([
  'manager', 'director', 'senior', 'lead', 'head', 'junior', 'associate',
  'principal', 'vice', 'chief', 'officer', 'specialist', 'analyst', 'executive',
  'and', 'of', 'the', 'for', 'at', 'with',
]);

export async function POST(request) {
  try {
    let userId;

    // Allow service-to-service call (from save-preferences) with user_id in body
    const authHeader = request.headers.get('authorization');
    const isServiceCall = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (isServiceCall) {
      const body = await request.json().catch(() => ({}));
      userId = body.user_id;
      if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    } else {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      userId = user.id;
    }

    // Await the full match — maxDuration=60 ensures Vercel doesn't kill it early
    await runInitialMatch(userId);

    return NextResponse.json({ status: 'matching_done' });
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
 * Query jobs whose title contains any of the role keywords.
 * Falls back to most-recent jobs if keywords yield < 10 results.
 */
async function fetchRelevantJobs(supabase, roleKeywords, limit) {
  if (roleKeywords.length > 0) {
    const orFilter = roleKeywords.map((w) => `title.ilike.%${w}%`).join(',');
    const { data } = await supabase
      .from('jobs')
      .select(JOB_SELECT)
      .eq('is_active', true)
      .or(orFilter)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (data?.length >= 10) return data;
    console.log(`[match/trigger] ${data?.length ?? 0} role-relevant jobs in DB (${roleKeywords.join(', ')})`);
  }

  // Generic fallback
  const { data } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('is_active', true)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  return data || [];
}

// ── Core matching function ────────────────────────────────────────────────────

async function runInitialMatch(userId) {
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

  if (!profile?.parsed_json || !userRow) return;

  const candidate   = buildCandidateSummary(profile, userRow);
  const profileHash = makeProfileHash(profile.parsed_json);
  // Only use explicit target_roles for keyword search — not CV content
  const roleKeywords = buildRoleKeywords(userRow.target_roles);

  // Fetch role-relevant jobs from existing DB only — fast (~10s)
  // Naukri enrichment happens via the 4h cron (scrape-jobs + match-jobs)
  const jobs = await fetchRelevantJobs(supabase, roleKeywords, INITIAL_BATCH * 3);

  const jobsToScore = jobs.slice(0, INITIAL_BATCH * 3);
  if (!jobsToScore.length) return;

  // Step 3: score in batches of 10
  const BATCH = 10;
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
    await supabase.from('job_matches').upsert(matchRecords, { onConflict: 'user_id,job_id' });
  }

  const goodMatches = matchRecords.filter((r) => r.match_score >= 40).length;
  console.log(`[match/trigger] scored ${matchRecords.length} jobs, ${goodMatches} passed intent gate (${roleKeywords.join(', ')})`);
}
