/**
 * POST /api/rolepitch/campaign/redeem
 * Body: { code: string }
 * Auth: Bearer token (implicit OAuth flow) or cookie.
 * Idempotent: returns existing redemption if user already redeemed this code.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { getAuthUser } from '@/lib/supabase/get-auth-user';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const user = await getAuthUser(supabase, request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const service = createServiceClient();

    const { data, error } = await service.rpc('redeem_campaign', {
      p_user_id: user.id,
      p_code: code,
    });

    if (error) {
      console.error('[campaign/redeem rpc]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.error) {
      // Already redeemed is not a hard error — surface as 200 idempotent
      if (data.error === 'Already redeemed') {
        return NextResponse.json({ already_redeemed: true });
      }
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({
      granted: data.granted,
      total_credits: data.total_credits,
      campaign_name: data.campaign_name,
    });
  } catch (err) {
    console.error('[campaign/redeem]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
