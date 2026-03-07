/**
 * GET /api/gmail/status
 *
 * Returns whether the user has Gmail connected.
 * Used by tracker page to show/hide the connect CTA.
 *
 * Returns: { connected: boolean, last_synced_at: string|null }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // gmail_tokens has no user-level RLS — must use service client
    const serviceSupabase = createServiceClient();
    const { data, error } = await serviceSupabase
      .from('gmail_tokens')
      .select('last_synced_at, connected_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      connected: !!data,
      last_synced_at: data?.last_synced_at || null,
      connected_at: data?.connected_at || null,
    });
  } catch (err) {
    console.error('[gmail/status]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/gmail/status — disconnect Gmail
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceSupabase = createServiceClient();
    await serviceSupabase.from('gmail_tokens').delete().eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[gmail/status DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
