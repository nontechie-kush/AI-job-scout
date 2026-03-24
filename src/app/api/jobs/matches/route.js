/**
 * GET  /api/jobs/matches  — fetch user's scored job matches (used by dashboard)
 * PATCH /api/jobs/matches — update match status (applied / dismissed / saved / viewed)
 *
 * GET query params:
 *   status    — pending | viewed | applied | dismissed | saved | all  (default: pending)
 *   limit     — max 50 (default: 20)
 *   offset    — for pagination (default: 0)
 *   min_score — filter by minimum match score (default: 0)
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { recordSignal } from '@/lib/flywheel/signals';

const EXCELLENT_SCORE = 75; // ≥75% = Excellent
const GOOD_SCORE = 50;      // 50–74% = Good, <50% = Others

export async function GET(request) {
  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const minScore = parseInt(searchParams.get('min_score') || '0', 10);
    const remindOnDesktop = searchParams.get('remind_on_desktop') === 'true';

    // Get user's last_active_at BEFORE updating it — used to compute is_new
    const { data: userRow } = await supabase
      .from('users')
      .select('last_active_at')
      .eq('id', user.id)
      .maybeSingle();
    const lastActive = userRow?.last_active_at ? new Date(userRow.last_active_at) : new Date(0);

    // Touch last_active_at now (fire-and-forget)
    supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id).then(() => {});

    // Main matches query
    let query = supabase
      .from('job_matches')
      .select(
        `id,
         match_score,
         match_reasons,
         gap_analysis,
         status,
         scored_at,
         viewed_at,
         jobs (
           id, title, company, company_domain,
           location, remote_type, company_stage,
           apply_url, apply_type, department,
           salary_min, salary_max, salary_currency,
           posted_at, repost_count, description, source
         )`,
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .gte('match_score', minScore)
      .order('match_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (remindOnDesktop) {
      query = query.eq('remind_on_desktop', true);
    } else if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Parallel: main query + cohort counts + new count (excellent+good only)
    const [
      { data, error, count },
      { count: excellentCount },
      { count: goodCount },
      { count: othersCount },
      { count: newCount },
    ] = await Promise.all([
      query,
      // Excellent: ≥75%
      supabase
        .from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('match_score', EXCELLENT_SCORE),
      // Good: 50–74%
      supabase
        .from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('match_score', GOOD_SCORE)
        .lt('match_score', EXCELLENT_SCORE),
      // Others: <50%
      supabase
        .from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .lt('match_score', GOOD_SCORE),
      // New: excellent or good scored since last visit (others don't count as "new")
      supabase
        .from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('match_score', GOOD_SCORE)
        .gt('scored_at', lastActive.toISOString()),
    ]);

    if (error) {
      // Column may not exist yet (e.g. remind_on_desktop) — return empty instead of 500
      if (error.message?.includes('column') || error.code === '42703') {
        return NextResponse.json({ matches: [], total: 0, excellent_count: 0, good_count: 0, others_count: 0, new_count: 0, has_more: false });
      }
      throw error;
    }

    // Annotate each match with is_new (excellent or good scored since last visit)
    const matches = (data || []).map((m) => ({
      ...m,
      is_new: m.scored_at && m.match_score >= GOOD_SCORE
        ? new Date(m.scored_at) > lastActive
        : false,
    }));

    return NextResponse.json({
      matches,
      total: count || 0,
      excellent_count: excellentCount || 0,
      good_count: goodCount || 0,
      others_count: othersCount || 0,
      new_count: newCount || 0,
      has_more: offset + limit < (count || 0),
    });
  } catch (err) {
    console.error('[jobs/matches GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Schema: dismissed_reason CHECK ('already_applied','too_senior','too_junior','wrong_industry','wrong_company','location','not_interested')
const VALID_DISMISSED_REASONS = new Set([
  'already_applied',
  'too_senior',
  'too_junior',
  'wrong_industry',
  'wrong_company',
  'location',
  'not_interested',
]);

export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, status, dismissed_reason, remind_on_desktop } = await request.json();

    // remind_on_desktop-only update (no status change needed)
    if (remind_on_desktop !== undefined && !status) {
      const { error } = await supabase
        .from('job_matches')
        .update({ remind_on_desktop: Boolean(remind_on_desktop) })
        .eq('id', match_id)
        .eq('user_id', user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const validStatuses = ['viewed', 'applied', 'dismissed', 'saved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (status === 'dismissed' && dismissed_reason && !VALID_DISMISSED_REASONS.has(dismissed_reason)) {
      return NextResponse.json({ error: 'Invalid dismissed_reason' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update = {
      status,
      ...(status === 'viewed' ? { viewed_at: now } : {}),
      ...(status !== 'viewed' ? { feedback_at: now } : {}),
      ...(status === 'dismissed' && dismissed_reason ? { dismissed_reason } : {}),
    };

    const { data: updatedMatch, error } = await supabase
      .from('job_matches')
      .update(update)
      .eq('id', match_id)
      .eq('user_id', user.id) // RLS guard
      .select('jobs(company_domain, source)')
      .maybeSingle();

    if (error) throw error;

    // Fire-and-forget flywheel signal on dismissal
    if (status === 'dismissed' && dismissed_reason) {
      const serviceClient = createServiceClient();
      recordSignal(serviceClient, {
        type: 'dismissal_reason',
        company_domain: updatedMatch?.jobs?.company_domain || null,
        job_source: updatedMatch?.jobs?.source || null,
        dismissed_reason,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[jobs/matches PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
