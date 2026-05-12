/**
 * GET /api/rolepitch/campaign/[code]
 * Public endpoint — landing page modal calls this on ?ref=CODE.
 * Returns campaign details if active + not expired, else 404.
 * Side effect: bumps click_count.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    const { code } = await params;
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const service = createServiceClient();

    const { data: campaign, error } = await service
      .from('rp_campaigns')
      .select('code, name, bonus_pitches, expires_at, active')
      .eq('code', code)
      .maybeSingle();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (!campaign.active) {
      return NextResponse.json({ error: 'Campaign inactive' }, { status: 410 });
    }

    if (new Date(campaign.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Campaign expired' }, { status: 410 });
    }

    // Fire-and-forget click counter
    service.rpc('bump_campaign_click', { p_code: code }).then(() => {}, () => {});

    return NextResponse.json({
      code: campaign.code,
      name: campaign.name,
      bonus_pitches: campaign.bonus_pitches,
      expires_at: campaign.expires_at,
    });
  } catch (err) {
    console.error('[campaign/[code]]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
