/**
 * POST /api/rolepitch/claim-critique
 *
 * Links an anonymous critique to the now-signed-in user.
 * Called right after OAuth completes.
 *
 * Strategy:
 *   1. Primary — match by critique_id from sessionStorage (most reliable)
 *   2. Fallback — match by email extracted from resume vs user.email
 *
 * Body: { critique_id? }  (optional — fallback uses email match)
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service-client';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { critique_id } = await request.json().catch(() => ({}));
    const service = createServiceClient();

    let claimed = 0;

    // Primary: claim by critique_id if provided and not yet owned
    if (critique_id) {
      const { data, error } = await service
        .from('rp_critiques')
        .update({ user_id: user.id })
        .eq('id', critique_id)
        .is('user_id', null)
        .gt('expires_at', new Date().toISOString())
        .select('id');
      if (!error && data?.length) claimed = data.length;
    }

    // Fallback: match unclaimed critiques by email
    if (claimed === 0 && user.email) {
      const { data, error } = await service
        .from('rp_critiques')
        .update({ user_id: user.id })
        .eq('email', user.email)
        .is('user_id', null)
        .gt('expires_at', new Date().toISOString())
        .select('id');
      if (!error && data?.length) claimed = data.length;
    }

    return NextResponse.json({ claimed });
  } catch (err) {
    console.error('[claim-critique]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
