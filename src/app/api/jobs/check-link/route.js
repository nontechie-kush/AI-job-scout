/**
 * GET /api/jobs/check-link?url=<encoded>[&match_id=<uuid>]
 *
 * Server-side HEAD check for an apply URL.
 * Returns { ok: true } if the link is reachable (2xx/3xx), { ok: false } otherwise.
 * Times out after 5s — if the server doesn't respond, we assume ok (benefit of doubt).
 *
 * If match_id is provided and the link is dead, auto-marks the job
 * status='unpublished_closed' (no user action needed — server confirmed it's gone).
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const matchId = searchParams.get('match_id');
  if (!url) return NextResponse.json({ ok: false, reason: 'no_url' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerPilot/1.0)' },
    });

    clearTimeout(timeout);

    // 404/410 = definitely dead. 403/401 = might be auth-gated (treat as ok).
    const dead = res.status === 404 || res.status === 410 || res.status === 400;

    if (dead && matchId) {
      // Auto-mark job as unpublished_closed — server confirmed the link is gone
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: match } = await supabase
            .from('job_matches')
            .select('job_id')
            .eq('id', matchId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (match) {
            const serviceClient = createServiceClient();
            await serviceClient
              .from('jobs')
              .update({ status: 'unpublished_closed', is_active: false })
              .eq('id', match.job_id)
              .eq('status', 'active'); // only close if still active (don't overwrite 'unpublished_reported')
          }
        }
      } catch {
        // Non-critical — link check result still returned correctly
      }
    }

    return NextResponse.json({ ok: !dead, status: res.status });
  } catch {
    // Timeout or network error — assume ok (benefit of doubt)
    return NextResponse.json({ ok: true, reason: 'timeout' });
  }
}
