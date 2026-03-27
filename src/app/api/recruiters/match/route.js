/**
 * GET /api/recruiters/match
 *
 * Scores recruiters from the shared `recruiters` table against the
 * authenticated user's profile and preferences, upserts the top matches
 * into `recruiter_matches`, and returns them with nested recruiter data.
 *
 * Scoring (0-100):
 *   Geography overlap (30)  — hard filter if no overlap
 *   Specialization match (30) — hard filter if no overlap
 *   Seniority match (25)
 *   Response rate bonus (15)
 *
 * Returns top 30 matches ordered by relevance_score DESC.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── Normalise user location strings → recruiter geography keys ──────────
function normGeo(locations = []) {
  const geo = new Set();
  for (const loc of locations) {
    const l = loc.toLowerCase();
    if (l.includes('india') || l === 'india') geo.add('india');
    if (l.includes('us') || l.includes('united states') || l === 'us_canada') geo.add('us');
    if (l.includes('canada') || l === 'us_canada') geo.add('canada');
    if (l.includes('remote') || l === 'remote') geo.add('global');
  }
  return [...geo];
}

// ── Infer user's specialization from profile + prefs ─────────────────────
function inferSpec(parsedJson, userPrefs) {
  const specs = new Set(['engineering']); // default
  const roles = [
    ...(parsedJson?.roles || []),
    ...(userPrefs?.target_roles || []),
  ].join(' ').toLowerCase();

  if (/product manager|pm\b/.test(roles)) specs.add('pm');
  if (/design|ux|ui/.test(roles)) specs.add('design');
  if (userPrefs?.ic_or_lead === 'lead') specs.add('leadership');

  return [...specs];
}

// ── Infer seniority level from profile ────────────────────────────────────
function inferSeniority(parsedJson) {
  const sen = (parsedJson?.seniority || '').toLowerCase();
  const yrs = parsedJson?.years_exp || 0;

  if (/director|vp|chief|c-level/.test(sen) || yrs >= 15) return 'csuite';
  if (/lead|staff|principal/.test(sen) || yrs >= 8) return 'lead';
  if (/senior|sr\./.test(sen) || yrs >= 5) return 'senior';
  if (/mid|intermediate/.test(sen) || yrs >= 3) return 'mid';
  return 'junior';
}

// ── Score a single recruiter ──────────────────────────────────────────────
function scoreRecruiter(recruiter, userGeo, userSpec, userSeniority) {
  const recGeo = recruiter.geography || [];
  const recSpec = recruiter.specialization || [];
  const recSen = recruiter.seniority_levels || [];

  // 1. Geography — hard filter
  const isGlobal = recGeo.includes('global');
  const geoMatch = isGlobal || recGeo.some((g) => userGeo.includes(g));
  if (!geoMatch) return null;

  // 2. Specialization — hard filter
  const specMatch = recSpec.some((s) => userSpec.includes(s));
  if (!specMatch) return null;

  const reasons = [];
  let score = 0;

  // Geography (30)
  score += 30;
  if (isGlobal) {
    reasons.push('Global reach');
  } else {
    const matched = recGeo.find((g) => userGeo.includes(g)) || recGeo[0];
    reasons.push(`${matched.charAt(0).toUpperCase() + matched.slice(1)} based`);
  }

  // Specialization (30)
  score += 30;
  const matchedSpecs = recSpec.filter((s) => userSpec.includes(s));
  const specLabel = {
    engineering: 'Engineering', pm: 'Product', design: 'Design', leadership: 'Leadership',
  };
  reasons.push(`${specLabel[matchedSpecs[0]] || 'Tech'} specialist`);

  // Seniority (25 full / 10 partial)
  if (recSen.includes(userSeniority)) {
    score += 25;
    reasons.push('Seniority match');
  } else {
    score += 10;
  }

  // Response rate bonus (15)
  const rate = recruiter.response_rate || 0;
  score += Math.round((rate / 100) * 15);
  if (rate >= 70) reasons.push(`${rate}% reply rate`);

  // Placements bonus (up to 10, capped)
  const placements = recruiter.placements_at || [];
  score += Math.min(10, placements.length * 2);

  return { score: Math.min(100, score), reasons };
}

// ── Handler ───────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user prefs + profile in parallel
    const [{ data: userRow }, { data: profile }] = await Promise.all([
      supabase.from('users')
        .select('locations, target_roles, ic_or_lead')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('profiles')
        .select('parsed_json')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const parsedJson = profile?.parsed_json || {};
    const userGeo = normGeo(userRow?.locations || ['india']); // default India if not set
    const userSpec = inferSpec(parsedJson, userRow);
    const userSeniority = inferSeniority(parsedJson);

    // Fetch all recruiters
    const { data: recruiters } = await supabase
      .from('recruiters')
      .select('id, name, title, current_company, type, specialization, seniority_levels, industry_focus, geography, cities, response_rate, avg_reply_days, placements_at, linkedin_url');

    if (!recruiters?.length) {
      return NextResponse.json({ matches: [] });
    }

    // Score each recruiter
    const scored = [];
    for (const rec of recruiters) {
      const result = scoreRecruiter(rec, userGeo, userSpec, userSeniority);
      if (result && result.score >= 40) {
        scored.push({ recruiter: rec, ...result });
      }
    }

    // Sort by score, take top 30
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 30);

    if (!top.length) {
      return NextResponse.json({ matches: [] });
    }

    // Upsert recruiter_matches — only update score/reasons, preserve existing status
    const upsertRows = top.map(({ recruiter, score, reasons }) => ({
      user_id: user.id,
      recruiter_id: recruiter.id,
      relevance_score: score,
      match_reasons: reasons,
      // status defaults to 'pending' on insert; not overwritten on conflict
    }));

    await supabase.from('recruiter_matches').upsert(upsertRows, {
      onConflict: 'user_id,recruiter_id',
      ignoreDuplicates: false,
      // update only these columns on conflict
      defaultToNull: false,
    }).select(); // just to flush the upsert

    // Fetch matches back with nested recruiter data
    const { data: matches, error } = await supabase
      .from('recruiter_matches')
      .select(`
        id, relevance_score, match_reasons, status,
        outreach_draft, outreach_sent_at, reply_received_at,
        recruiters!inner (
          id, name, title, current_company, type,
          specialization, geography, cities,
          placements_at, response_rate, avg_reply_days, linkedin_url
        )
      `)
      .eq('user_id', user.id)
      .order('relevance_score', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ matches: matches || [] });
  } catch (err) {
    console.error('[recruiters/match]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
