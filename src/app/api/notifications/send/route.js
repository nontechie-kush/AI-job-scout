/**
 * POST /api/notifications/send
 *
 * Internal route — send a push notification to a specific user.
 * Protected by CRON_SECRET (not user-facing).
 *
 * Body: { user_id, title, body, action_url?, type? }
 *
 * type: action_reminder | signal_alert | re_engagement | offboarding
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push/send';
import { isConfigured } from '@/lib/push/vapid';

export async function POST(request) {
  // Internal only
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { user_id, title, body, action_url, type = 'signal_alert' } = await request.json();

    if (!user_id || !title || !body) {
      return NextResponse.json({ error: 'user_id, title, body required' }, { status: 400 });
    }

    if (!isConfigured()) {
      return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 });
    }

    const supabase = createServiceClient();

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('notif_push, push_endpoint, push_p256dh, push_auth_key')
      .eq('id', user_id)
      .single();

    if (userErr || !userRow?.notif_push || !userRow?.push_endpoint) {
      return NextResponse.json({ error: 'User not subscribed to push' }, { status: 404 });
    }

    await sendPushToUser(userRow, { title, body, action_url });

    // Record delivery
    await supabase.from('notifications').insert({
      user_id,
      type,
      title,
      body,
      action_url: action_url || '/dashboard',
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notifications/send]', err);
    // 410 Gone = subscription expired — clean it up
    if (err.statusCode === 410) {
      const supabase = createServiceClient();
      const body = await request.json().catch(() => ({}));
      if (body.user_id) {
        await supabase
          .from('users')
          .update({ notif_push: false, push_endpoint: null, push_p256dh: null, push_auth_key: null })
          .eq('id', body.user_id);
      }
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
