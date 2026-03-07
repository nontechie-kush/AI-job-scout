/**
 * POST /api/jobs/report-link
 *
 * User reports a broken apply link.
 * - Dismisses the user's match (dismissed_reason='broken_link') always
 * - Increments report_count on the job always
 * - If report_count reaches 2+: sets status='unpublished_reported' + is_active=false
 *   (single report never kills the job platform-wide — could be user error)
 *
 * Body: { match_id }
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const REPORT_THRESHOLD = 2;

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id } = await request.json();
    if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

    // Get the job_id from the match
    const { data: match } = await supabase
      .from('job_matches')
      .select('job_id')
      .eq('id', match_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const serviceClient = createServiceClient();

    // Dismiss the match for this user
    await supabase
      .from('job_matches')
      .update({ status: 'dismissed', dismissed_reason: 'broken_link' })
      .eq('id', match_id)
      .eq('user_id', user.id);

    // Fetch current report_count, then increment
    const { data: currentJob } = await serviceClient
      .from('jobs')
      .select('report_count')
      .eq('id', match.job_id)
      .maybeSingle();

    const newCount = (currentJob?.report_count ?? 0) + 1;

    const jobUpdate = { report_count: newCount };
    if (newCount >= REPORT_THRESHOLD) {
      jobUpdate.status = 'unpublished_reported';
      jobUpdate.is_active = false;
    }

    await serviceClient
      .from('jobs')
      .update(jobUpdate)
      .eq('id', match.job_id);

    return NextResponse.json({ success: true, platform_removed: newCount >= REPORT_THRESHOLD });
  } catch (err) {
    console.error('[report-link]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
