/**
 * GET /api/cron/notify
 *
 * Vercel Cron — runs every 30 minutes.
 * Evaluates and dispatches push notifications for all subscribed users.
 *
 * Notification types (in priority order):
 *   1. signal_alert  — Gmail detected reply/interview/offer in last 2h
 *   2. re_engagement — last_active_at > 3 days
 *   3. action_reminder — pending job_matches > 0 AND cadence interval passed
 *
 * Night cutoff:
 *   India: no notifications 8PM–8AM IST (UTC+5:30)
 *   US/CA: no notifications 6PM–8AM EST (UTC-5)
 *   Default: IST
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push/send';
import { isConfigured } from '@/lib/push/vapid';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Cadence intervals in milliseconds
const CADENCE_MS = {
  every_4h: 4 * 60 * 60 * 1000,
  daily: 20 * 60 * 60 * 1000, // 20h (allows slight drift)
  urgent_only: Infinity,       // Never action reminders, only signals
  manual: Infinity,
};

const RE_ENGAGEMENT_DAYS_1 = 3;
const RE_ENGAGEMENT_DAYS_2 = 7;
const SIGNAL_LOOKBACK_HOURS = 2;

/**
 * Returns true if the current UTC time falls within the quiet night window
 * for the given location preference.
 */
function isNightCutoff(locations) {
  const locStr = (locations || []).join(' ').toLowerCase();
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcDecimal = utcHour + utcMin / 60;

  const isUS = locStr.includes('united states') || locStr.includes('canada');
  const isIndia = locStr.includes('india');

  if (isUS) {
    // EST = UTC-5. Quiet: 6PM–8AM EST = 23:00–13:00 UTC
    const estHour = (utcDecimal - 5 + 24) % 24;
    return estHour >= 18 || estHour < 8;
  }

  // Default: India IST = UTC+5:30. Quiet: 8PM–8AM IST = 14:30–02:30 UTC
  const istHour = (utcDecimal + 5.5) % 24;
  return istHour >= 20 || istHour < 8;
}

// ── Pilot voice copy ───────────────────────────────────────────

function buildSignalPayload(stage, company) {
  const co = company || 'them';
  if (stage === 'offer') {
    return {
      title: "It's an offer.",
      body: `${co} came through. Open it.`,
      action_url: '/dashboard/tracker',
    };
  }
  if (stage === 'interviewing') {
    return {
      title: 'Interview invite.',
      body: `${co} wants to meet. Draft ready.`,
      action_url: '/dashboard/tracker',
    };
  }
  return {
    title: `${co} replied.`,
    body: 'Check pipeline — next move ready.',
    action_url: '/dashboard/tracker',
  };
}

function buildReEngagementPayload(daysSince) {
  if (daysSince >= 7) {
    return {
      title: 'Still here. No rush.',
      body: "Whenever you're ready. — Pilot",
      action_url: '/dashboard',
    };
  }
  return {
    title: 'Hey. 3 days. You okay?',
    body: 'Your matches are waiting. — Pilot',
    action_url: '/dashboard',
  };
}

function buildActionReminderPayload(pendingCount) {
  if (pendingCount === 1) {
    return {
      title: '1 job ready.',
      body: "Quick look — might be the one.",
      action_url: '/dashboard/jobs',
    };
  }
  return {
    title: `${pendingCount} jobs ready.`,
    body: 'Sorted by fit. Takes 2 minutes.',
    action_url: '/dashboard/jobs',
  };
}

// ── Main cron handler ──────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ message: 'VAPID not configured — skipping' });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const results = { sent: 0, skipped: 0, errors: 0 };

  // Get all push-subscribed users (notif_push=true, endpoint set, cadence not manual)
  const { data: users } = await supabase
    .from('users')
    .select('id, locations, notif_cadence, notif_push, push_endpoint, push_p256dh, push_auth_key, last_active_at')
    .eq('notif_push', true)
    .not('push_endpoint', 'is', null)
    .neq('notif_cadence', 'manual');

  if (!users?.length) {
    return NextResponse.json({ message: 'No subscribed users', duration_ms: Date.now() - startedAt });
  }

  const now = Date.now();
  const signalLookback = new Date(now - SIGNAL_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  for (const user of users) {
    try {
      // Night cutoff check
      if (isNightCutoff(user.locations)) {
        results.skipped++;
        continue;
      }

      // Get last notification sent to this user
      const { data: lastNotif } = await supabase
        .from('notifications')
        .select('sent_at, type')
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastSentMs = lastNotif?.sent_at ? new Date(lastNotif.sent_at).getTime() : 0;

      // ── 1. Signal alerts (bypass cadence — always immediate within lookback) ──
      // Check for high-signal pipeline stage changes in the last 2h
      const { data: signals } = await supabase
        .from('pipeline')
        .select('stage, company, last_activity_at')
        .eq('user_id', user.id)
        .in('stage', ['replied', 'interviewing', 'offer'])
        .gte('last_activity_at', signalLookback)
        .order('last_activity_at', { ascending: false })
        .limit(1);

      if (signals?.length) {
        // Skip if we already sent a signal_alert in the last 30 min
        const lastSignalMs = lastNotif?.type === 'signal_alert'
          ? new Date(lastNotif.sent_at).getTime() : 0;
        const thirtyMin = 30 * 60 * 1000;

        if (now - lastSignalMs > thirtyMin) {
          const signal = signals[0];
          const payload = buildSignalPayload(signal.stage, signal.company);
          await sendAndRecord(supabase, user, payload, 'signal_alert');
          results.sent++;
          continue;
        }
      }

      // ── 2. Re-engagement (if last_active old) ──
      const lastActiveMs = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;
      const daysSinceActive = (now - lastActiveMs) / (1000 * 60 * 60 * 24);

      if (daysSinceActive >= RE_ENGAGEMENT_DAYS_1) {
        // Only send re-engagement once per day
        if (now - lastSentMs > 20 * 60 * 60 * 1000) {
          const payload = buildReEngagementPayload(Math.floor(daysSinceActive));
          await sendAndRecord(supabase, user, payload, 're_engagement');
          results.sent++;
          continue;
        }
      }

      // ── 3. Scheduled outreach reminders ──
      const { data: dueOutreach } = await supabase
        .from('recruiter_matches')
        .select('id, scheduled_at, recruiters!inner(name)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .not('scheduled_at', 'is', null)
        .lte('scheduled_at', new Date().toISOString())
        .limit(1);

      if (dueOutreach?.length) {
        const rec = dueOutreach[0].recruiters;
        await sendAndRecord(supabase, user, {
          title: `DM ${rec.name} — now's the time.`,
          body: 'Your message is drafted. 90 seconds. — Pilot',
          action_url: '/dashboard/referrals',
        }, 'action_reminder');
        // Clear scheduled_at so it doesn't fire again
        await supabase
          .from('recruiter_matches')
          .update({ scheduled_at: null })
          .eq('id', dueOutreach[0].id);
        results.sent++;
        continue;
      }

      // ── 4. Action reminders (respect cadence) ──
      if (user.notif_cadence === 'urgent_only') {
        results.skipped++;
        continue;
      }

      const cadenceMs = CADENCE_MS[user.notif_cadence] || CADENCE_MS.every_4h;
      if (now - lastSentMs < cadenceMs) {
        results.skipped++;
        continue;
      }

      // Count pending job matches
      const { count: pendingCount } = await supabase
        .from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (!pendingCount || pendingCount === 0) {
        results.skipped++;
        continue;
      }

      const payload = buildActionReminderPayload(pendingCount);
      await sendAndRecord(supabase, user, payload, 'action_reminder');
      results.sent++;
    } catch (err) {
      console.error(`[cron/notify] user ${user.id}:`, err.message);
      // If subscription expired (410), clean it up
      if (err.statusCode === 410 || err.body?.includes('unsubscribed')) {
        await supabase
          .from('users')
          .update({ notif_push: false, push_endpoint: null, push_p256dh: null, push_auth_key: null })
          .eq('id', user.id);
      }
      results.errors++;
    }
  }

  console.log(`[cron/notify] done — sent:${results.sent} skipped:${results.skipped} errors:${results.errors} in ${Date.now() - startedAt}ms`);

  return NextResponse.json({
    duration_ms: Date.now() - startedAt,
    users_evaluated: users.length,
    ...results,
  });
}

async function sendAndRecord(supabase, user, payload, type) {
  await sendPushToUser(user, payload);
  await supabase.from('notifications').insert({
    user_id: user.id,
    type,
    title: payload.title,
    body: payload.body,
    action_url: payload.action_url,
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}
