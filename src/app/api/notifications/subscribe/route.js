/**
 * POST /api/notifications/subscribe
 *
 * Saves the user's Web Push subscription to the users table.
 * Called by PushPrompt component after permission is granted.
 *
 * Body: PushSubscription object
 *   { endpoint, keys: { p256dh, auth } }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const subscription = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({
        notif_push: true,
        push_endpoint: subscription.endpoint,
        push_p256dh: subscription.keys?.p256dh || null,
        push_auth_key: subscription.keys?.auth || null,
      })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notifications/subscribe]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — unsubscribe (clear push data)
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await supabase
      .from('users')
      .update({ notif_push: false, push_endpoint: null, push_p256dh: null, push_auth_key: null })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notifications/subscribe DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
