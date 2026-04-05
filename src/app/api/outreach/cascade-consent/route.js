/**
 * POST /api/outreach/cascade-consent
 *
 * User consents to switch outreach method for paused jobs.
 *
 * Body: {
 *   action: 'approve_dm' | 'approve_email' | 'defer',
 *   job_ids?: string[]  // optional — if omitted, applies to all paused jobs for user
 * }
 *
 * - approve_dm:    connect_limit_hit → dm_pending_review (method → 'dm')
 * - approve_email: dm_limit_hit → email_pending_review (method → 'email')
 *                  Jobs where recruiter has no email → 'deferred'
 * - defer:         all paused jobs → 'deferred'
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, job_ids } = await request.json();
    if (!['approve_dm', 'approve_email', 'defer'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'approve_dm') {
      // Also include dm_pending_review jobs that came from already_connected/restricted reroutes
      let query = supabase
        .from('outreach_queue')
        .update({
          status: 'dm_pending_review',
          outreach_method: 'dm',
          result_detail: 'user_consented_dm',
        })
        .eq('user_id', user.id)
        .eq('status', 'connect_limit_hit');

      if (job_ids?.length) query = query.in('id', job_ids);
      const { error, count } = await query;
      if (error) throw error;

      // Fetch all dm_pending_review jobs that need DM drafts generated
      const { data: dmJobs } = await supabase
        .from('outreach_queue')
        .select('id, recruiter_match_id, dm_body')
        .eq('user_id', user.id)
        .eq('status', 'dm_pending_review');

      // Generate DM drafts for jobs that don't have one yet
      const needDrafts = (dmJobs || []).filter(j => !j.dm_body);
      if (needDrafts.length) {
        // Generate drafts via /api/recruiters/outreach with mode: 'dm_draft'
        // Using inline generation for now (same hardcoded defaults) to avoid HTTP self-calls
        // TODO: when AI is re-enabled, call buildOutreachPrompt with mode: 'dm_draft'
        await Promise.all(needDrafts.map(async (job) => {
          const dmSubject = 'Connecting on LinkedIn';
          const dmBody = 'Hi, It would be great to connect. Regards Kushendra';
          await supabase
            .from('outreach_queue')
            .update({ dm_subject: dmSubject, dm_body: dmBody })
            .eq('id', job.id);
        }));
      }

      return NextResponse.json({
        ok: true,
        moved: count || 0,
        to: 'dm_pending_review',
        drafts_generated: needDrafts.length,
      });
    }

    if (action === 'approve_email') {
      // First, find the paused DM jobs + their recruiter emails
      let fetchQuery = supabase
        .from('outreach_queue')
        .select('id, recruiter_match_id')
        .eq('user_id', user.id)
        .eq('status', 'dm_limit_hit');

      if (job_ids?.length) fetchQuery = fetchQuery.in('id', job_ids);
      const { data: pausedJobs, error: fetchErr } = await fetchQuery;
      if (fetchErr) throw fetchErr;

      if (!pausedJobs?.length) {
        return NextResponse.json({ ok: true, moved: 0, deferred: 0 });
      }

      // Look up recruiter emails
      const matchIds = pausedJobs.map(j => j.recruiter_match_id);
      const { data: matches } = await supabase
        .from('recruiter_matches')
        .select('id, recruiters(email)')
        .in('id', matchIds);

      const matchEmailMap = {};
      for (const m of (matches || [])) {
        matchEmailMap[m.id] = m.recruiters?.email || null;
      }

      const withEmail = [];
      const withoutEmail = [];
      for (const job of pausedJobs) {
        if (matchEmailMap[job.recruiter_match_id]) {
          withEmail.push(job.id);
        } else {
          withoutEmail.push(job.id);
        }
      }

      // Jobs WITH email → email_pending_review
      if (withEmail.length) {
        await supabase
          .from('outreach_queue')
          .update({
            status: 'email_pending_review',
            outreach_method: 'email',
            result_detail: 'user_consented_email',
          })
          .in('id', withEmail);
      }

      // Jobs WITHOUT email → deferred
      if (withoutEmail.length) {
        await supabase
          .from('outreach_queue')
          .update({
            status: 'deferred',
            result_detail: 'no_recruiter_email',
            completed_at: new Date().toISOString(),
          })
          .in('id', withoutEmail);
      }

      return NextResponse.json({
        ok: true,
        moved: withEmail.length,
        deferred: withoutEmail.length,
        to: 'email_pending_review',
      });
    }

    if (action === 'defer') {
      let query = supabase
        .from('outreach_queue')
        .update({
          status: 'deferred',
          result_detail: 'user_deferred',
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .in('status', ['connect_limit_hit', 'dm_pending_review', 'dm_limit_hit', 'email_pending_review']);

      if (job_ids?.length) query = query.in('id', job_ids);
      const { error, count } = await query;
      if (error) throw error;

      return NextResponse.json({ ok: true, deferred: count || 0 });
    }
  } catch (err) {
    console.error('[outreach/cascade-consent]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
