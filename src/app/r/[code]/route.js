/**
 * GET /r/[code]
 * Short referral URL → 302 redirects to /?ref=CODE&utm_*=...
 * Pulls UTM params from the campaign row so the share link stays clean
 * but Google Analytics still sees the full attribution.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { code } = await params;
  const cleanCode = (code || '').toUpperCase();

  const dest = new URL('https://www.rolepitch.com/');
  dest.searchParams.set('ref', cleanCode);

  try {
    const service = createServiceClient();
    const { data: campaign } = await service
      .from('rp_campaigns')
      .select('utm_source, utm_medium, utm_campaign, utm_content, active, expires_at')
      .eq('code', cleanCode)
      .maybeSingle();

    if (campaign) {
      if (campaign.utm_source) dest.searchParams.set('utm_source', campaign.utm_source);
      if (campaign.utm_medium) dest.searchParams.set('utm_medium', campaign.utm_medium);
      if (campaign.utm_campaign) dest.searchParams.set('utm_campaign', campaign.utm_campaign);
      if (campaign.utm_content) dest.searchParams.set('utm_content', campaign.utm_content);
    }
  } catch {}

  return NextResponse.redirect(dest, { status: 302 });
}
