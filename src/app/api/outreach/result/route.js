/**
 * POST /api/outreach/result
 *
 * Extension calls this after each LinkedIn automation attempt.
 * Updates outreach_queue + recruiter_matches with the result.
 *
 * Body: {
 *   job_id:        string,    // outreach_queue.id
 *   status:        string,    // 'sent'|'dm_sent'|'limit_hit'|'failed'|'interrupted'|'already_pending'|'profile_not_found'|'captcha'|'restricted'|'account_restricted'
 *   result_detail: string,    // optional extra detail
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/get-auth-user';

export const dynamic = 'force-dynamic';

// Map outreach result status → recruiter_matches status
const MATCH_STATUS_MAP = {
  sent:               'messaged',
  dm_sent:            'messaged',
  limit_hit:          'pending',     // keep as pending — user will retry
  failed:             'pending',
  interrupted:        'pending',
  already_pending:    'pending',     // LI already has a pending request
  profile_not_found:  'pending',
  captcha:            'pending',
  restricted:         'pending',
  account_restricted: 'pending',
};

const TERMINAL_STATUSES = new Set(['sent', 'dm_sent', 'limit_hit', 'failed', 'interrupted', 'already_pending', 'profile_not_found', 'restricted']);

export async function POST(request) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase, request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id, status, result_detail } = await request.json();
    if (!job_id || !status) {
      return NextResponse.json({ error: 'job_id and status required' }, { status: 400 });
    }

    // Fetch the job (verify ownership)
    const { data: job, error: jobError } = await supabase
      .from('outreach_queue')
      .select('id, recruiter_match_id, status')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Update queue job
    await supabase
      .from('outreach_queue')
      .update({
        status,
        result_detail: result_detail || null,
        completed_at: TERMINAL_STATUSES.has(status) ? new Date().toISOString() : null,
      })
      .eq('id', job_id);

    // Update recruiter_matches
    const matchStatus = MATCH_STATUS_MAP[status] || 'pending';
    const matchUpdate = { status: matchStatus };
    if (status === 'sent' || status === 'dm_sent') {
      matchUpdate.outreach_sent_at = new Date().toISOString();
    }

    await supabase
      .from('recruiter_matches')
      .update(matchUpdate)
      .eq('id', job.recruiter_match_id)
      .eq('user_id', user.id);

    // If connection limit hit — cancel all remaining pending jobs for this user
    // so they don't keep trying. User re-triggers when limit resets.
    if (status === 'limit_hit') {
      await supabase
        .from('outreach_queue')
        .update({ status: 'cancelled', result_detail: 'linkedin_limit_hit' })
        .eq('user_id', user.id)
        .eq('status', 'pending');
    }

    // If account restricted — cancel everything and flag urgently
    if (status === 'account_restricted') {
      await supabase
        .from('outreach_queue')
        .update({ status: 'cancelled', result_detail: 'account_restricted' })
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing']);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[outreach/result]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
