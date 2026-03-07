/**
 * PATCH /api/recruiter-matches/update
 *
 * Updates a recruiter_match status.
 * When status → 'messaged', also inserts a pipeline entry (type=outreach, stage=messaged).
 *
 * Body: { id, status, message? }
 *
 * Valid statuses: pending | messaged | replied | no_response | placed
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { recordSignal } from '@/lib/flywheel/signals';

const VALID_STATUSES = new Set(['pending', 'messaged', 'replied', 'no_response', 'placed']);

export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, status, message, scheduled_at, outreach_channel } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Allow schedule-only updates (no status change)
    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update = {};
    if (status) update.status = status;
    if (status === 'messaged') update.outreach_sent_at = now;
    if (status === 'replied') update.reply_received_at = now;
    if (message) update.outreach_draft = message;
    if (scheduled_at !== undefined) update.scheduled_at = scheduled_at; // null clears it
    if (outreach_channel) update.outreach_channel = outreach_channel;

    const { data: match, error } = await supabase
      .from('recruiter_matches')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        id, recruiter_id, outreach_sent_at,
        recruiters!inner (name, current_company, title)
      `)
      .maybeSingle();

    if (error) throw error;
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Fire-and-forget flywheel signal on recruiter reply
    if (status === 'replied') {
      const serviceClient = createServiceClient();
      // Compute days to reply
      let days = null;
      if (update.reply_received_at && match.outreach_sent_at) {
        days = Math.round(
          (new Date(update.reply_received_at) - new Date(match.outreach_sent_at)) / (1000 * 60 * 60 * 24),
        );
      }
      recordSignal(serviceClient, {
        type: 'recruiter_response',
        outcome: 'replied',
        time_to_outcome_days: days,
      });
    }

    // When messaged → add pipeline entry
    if (status === 'messaged') {
      const rec = match.recruiters;
      const company = rec.current_company || rec.name;
      const logoChar = company ? company[0].toUpperCase() : 'R';

      const { error: pipeErr } = await supabase.from('pipeline').insert({
        user_id: user.id,
        recruiter_id: match.recruiter_id,
        type: 'outreach',
        stage: 'messaged',
        company,
        role_title: rec.title || 'Recruiter',
        company_logo_char: logoChar,
        source: 'manual',
        applied_at: now,
        last_activity_at: now,
        notes: `Outreach to ${rec.name}`,
      });

      if (pipeErr) {
        // Non-fatal: log but don't fail the request
        console.warn('[recruiter-matches/update] pipeline insert failed:', pipeErr.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[recruiter-matches/update]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
