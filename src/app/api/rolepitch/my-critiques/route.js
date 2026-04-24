/**
 * GET /api/rolepitch/my-critiques
 *
 * Returns all non-expired critiques belonging to the signed-in user.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service-client';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceClient();
    const { data, error } = await service
      .from('rp_critiques')
      .select('id, name, target_context, critique_json, created_at, expires_at')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ critiques: data || [] });
  } catch (err) {
    console.error('[my-critiques]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
