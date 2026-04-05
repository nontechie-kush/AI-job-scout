/**
 * POST /api/outreach/queue
 *
 * Web app calls this when user taps "Start Automation".
 * Creates outreach_queue jobs for the selected recruiter matches.
 * Extension polls /api/outreach/pending to pick them up.
 *
 * Body: {
 *   jobs: [{ match_id, linkedin_handle, connection_note, dm_subject, dm_body, outreach_method? }],
 *   source?: 'mobile' | 'extension',
 *   script_version?: string
 * }
 * Returns: { queued, skipped, batch_id, positions }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const VALID_METHODS = new Set(['connect', 'dm', 'email']);

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { jobs, source, script_version } = body;
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'jobs array required' }, { status: 400 });
    }
    // Cap at 15 per batch (LinkedIn daily safety limit)
    const batch = jobs.slice(0, 15);
    const matchIds = batch.map(j => j.match_id);
    const batchId = randomUUID();

    // Reset stuck 'processing' jobs older than 5 minutes back to 'pending'
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from('outreach_queue')
      .update({ status: 'pending', picked_up_at: null })
      .in('recruiter_match_id', matchIds)
      .eq('status', 'processing')
      .lt('picked_up_at', fiveMinutesAgo);

    // Check for already-queued or already-sent jobs for these match IDs
    const { data: existing } = await supabase
      .from('outreach_queue')
      .select('recruiter_match_id, status')
      .in('recruiter_match_id', matchIds)
      .in('status', ['pending', 'processing', 'sent', 'dm_sent', 'dm_approved']);

    const existingIds = new Set((existing || []).map(e => e.recruiter_match_id));

    const toInsert = [];
    const positions = {};
    let position = 1;

    for (const job of batch) {
      if (existingIds.has(job.match_id)) continue;
      if (!job.linkedin_handle || !job.connection_note) continue;

      const method = VALID_METHODS.has(job.outreach_method) ? job.outreach_method : 'connect';

      toInsert.push({
        user_id:             user.id,
        recruiter_match_id:  job.match_id,
        linkedin_handle:     job.linkedin_handle,
        connection_note:     job.connection_note.slice(0, 300),
        dm_subject:          job.dm_subject || '',
        dm_body:             job.dm_body || '',
        status:              'pending',
        queue_position:      position,
        outreach_method:     method,
        batch_id:            batchId,
      });
      positions[job.match_id] = position;
      position++;
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ queued: 0, skipped: batch.length, batch_id: batchId, positions: {} });
    }

    const { error } = await supabase.from('outreach_queue').insert(toInsert);
    if (error) throw error;

    // Log this automation request
    const profileIds = toInsert.map(j => j.recruiter_match_id);
    await supabase.from('automation_requests').insert({
      id: batchId,
      user_id: user.id,
      user_email: user.email || '',
      source: source || 'unknown',
      script_version: script_version || '',
      profile_ids: profileIds,
      profile_results: {},
      total_profiles: toInsert.length,
      sent_count: 0,
      failed_count: 0,
      failure_buckets: {},
      status: 'in_progress',
    }).then(() => {}).catch(e => console.error('[automation_requests] insert failed:', e.message));

    return NextResponse.json({
      queued: toInsert.length,
      skipped: batch.length - toInsert.length,
      batch_id: batchId,
      positions,
    });
  } catch (err) {
    console.error('[outreach/queue]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
