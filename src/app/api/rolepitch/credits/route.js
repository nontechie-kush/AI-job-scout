/**
 * GET /api/rolepitch/credits
 * Returns the authenticated user's pitch credit balance and plan tier.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceClient();
    const { data, error } = await service
      .from('users')
      .select('pitch_credits, plan_tier')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      // User row may not exist yet (first sign-in) — return defaults
      return NextResponse.json({ pitch_credits: 5, plan_tier: 'free' });
    }

    return NextResponse.json({
      pitch_credits: data.pitch_credits ?? 5,
      plan_tier: data.plan_tier ?? 'free',
    });
  } catch (err) {
    console.error('[credits]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
