/**
 * GET /api/outreach/pending
 *
 * Extension polls this every 15s to check for queued jobs.
 * Returns the next pending job for this user and marks it as 'processing'.
 * Only one job is returned at a time — extension processes sequentially.
 *
 * Returns: { job: { id, linkedin_handle, connection_note, dm_subject, dm_body, queue_position, total } | null }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/get-auth-user';

export const dynamic = 'force-dynamic';

// Reset stuck 'processing' jobs older than 5 minutes back to 'pending'
async function resetStuckJobs(supabase, userId) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from('outreach_queue')
    .update({ status: 'pending', picked_up_at: null })
    .eq('user_id', userId)
    .eq('status', 'processing')
    .lt('picked_up_at', fiveMinutesAgo);
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase, request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await resetStuckJobs(supabase, user.id);

    // Get total pending count for progress display
    const { count: totalPending } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    // Fetch the next pending job (lowest queue_position)
    const { data: job, error } = await supabase
      .from('outreach_queue')
      .select('id, linkedin_handle, connection_note, dm_subject, dm_body, queue_position')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('queue_position', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!job) return NextResponse.json({ job: null, total: 0 });

    // Mark as processing
    await supabase
      .from('outreach_queue')
      .update({ status: 'processing', picked_up_at: new Date().toISOString() })
      .eq('id', job.id);

    return NextResponse.json({ job, total: (totalPending || 0) + 1 });
  } catch (err) {
    console.error('[outreach/pending]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
