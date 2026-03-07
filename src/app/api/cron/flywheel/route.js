/**
 * GET /api/cron/flywheel
 *
 * Vercel Cron — runs weekly Sunday at 3AM UTC.
 * Aggregates flywheel signals into actionable computed columns.
 *
 * Tasks (in order):
 *   1. Update recruiters.response_rate from recruiter_matches data
 *   2. Update recruiters.avg_reply_days from recruiter_matches data
 *   3. Mark jobs.is_ghost where no pipeline movement in 90 days
 *   4. Summarise flywheel_signals dismissal patterns (log only for now)
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const results = {
    recruiters_updated: 0,
    jobs_ghosted: 0,
    signals_summarised: 0,
  };

  // ── 1. Compute recruiter stats from recruiter_matches ────────────────
  const { data: matchStats } = await supabase
    .from('recruiter_matches')
    .select('recruiter_id, status, outreach_sent_at, reply_received_at')
    .in('status', ['messaged', 'replied', 'no_response', 'placed']);

  if (matchStats?.length) {
    // Aggregate per recruiter
    const stats = {};
    for (const m of matchStats) {
      if (!stats[m.recruiter_id]) {
        stats[m.recruiter_id] = { total: 0, replied: 0, replyDays: [] };
      }
      const s = stats[m.recruiter_id];
      s.total++;
      if (m.status === 'replied' || m.status === 'placed') {
        s.replied++;
        if (m.outreach_sent_at && m.reply_received_at) {
          const days =
            (new Date(m.reply_received_at) - new Date(m.outreach_sent_at)) /
            (1000 * 60 * 60 * 24);
          if (days >= 0 && days < 365) s.replyDays.push(days);
        }
      }
    }

    // Update each recruiter
    for (const [recruiterId, s] of Object.entries(stats)) {
      const response_rate = s.total > 0 ? Math.round((s.replied / s.total) * 100) : 0;
      const avg_reply_days =
        s.replyDays.length > 0
          ? Math.round((s.replyDays.reduce((a, b) => a + b, 0) / s.replyDays.length) * 10) / 10
          : null;

      const update = { response_rate };
      if (avg_reply_days !== null) update.avg_reply_days = avg_reply_days;

      const { error } = await supabase
        .from('recruiters')
        .update(update)
        .eq('id', recruiterId);

      if (!error) results.recruiters_updated++;
    }
  }

  // ── 2. Mark ghost jobs ───────────────────────────────────────────────
  // A job is "ghost" if it's been active for 90+ days but no user has
  // moved it to interviewing or offer stage.
  const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get job IDs that have had real pipeline movement recently
  const { data: activeJobIds } = await supabase
    .from('pipeline')
    .select('job_id')
    .in('stage', ['interviewing', 'offer'])
    .gte('last_activity_at', cutoff90d)
    .not('job_id', 'is', null);

  const activeSet = new Set((activeJobIds || []).map((r) => r.job_id));

  // Get old active jobs
  const { data: oldJobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('is_active', true)
    .eq('is_ghost', false)
    .lt('first_seen_at', cutoff90d);

  const ghostIds = (oldJobs || [])
    .filter((j) => !activeSet.has(j.id))
    .map((j) => j.id);

  if (ghostIds.length > 0) {
    // Batch update in chunks of 100
    for (let i = 0; i < ghostIds.length; i += 100) {
      const chunk = ghostIds.slice(i, i + 100);
      const { error } = await supabase
        .from('jobs')
        .update({ is_ghost: true })
        .in('id', chunk);
      if (!error) results.jobs_ghosted += chunk.length;
    }
  }

  // ── 3. Summarise dismissal signals ──────────────────────────────────
  // Count dismissal reasons in the past 7 days for logging
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSignals } = await supabase
    .from('flywheel_signals')
    .select('dismissed_reason')
    .eq('signal_type', 'dismissal_reason')
    .gte('created_at', since7d)
    .not('dismissed_reason', 'is', null);

  if (recentSignals?.length) {
    const counts = {};
    for (const s of recentSignals) {
      counts[s.dismissed_reason] = (counts[s.dismissed_reason] || 0) + 1;
    }
    results.signals_summarised = recentSignals.length;
    console.log('[cron/flywheel] dismissal reasons this week:', counts);
  }

  const duration = Date.now() - startedAt;
  console.log(`[cron/flywheel] done — recruiters:${results.recruiters_updated} ghosted:${results.jobs_ghosted} in ${duration}ms`);

  return NextResponse.json({ duration_ms: duration, ...results });
}
