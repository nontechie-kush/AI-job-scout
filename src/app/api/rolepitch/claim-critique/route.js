/**
 * POST /api/rolepitch/claim-critique
 *
 * Links an anonymous critique to the now-signed-in user.
 * Called right after OAuth completes.
 *
 * Strategy:
 *   1. Primary — match by critique_id from localStorage (most reliable)
 *   2. Fallback — match by email extracted from resume vs user.email
 *
 * Auth: accepts cookie OR Authorization: Bearer <access_token>
 *   (implicit OAuth doesn't write a server cookie immediately, so the
 *    client passes the access_token from the URL hash directly)
 *
 * Body: { critique_id? }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

function makeRid() {
  return `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/claim-critique ${rid}] START`, { has_auth: !!request.headers.get('authorization') });

  try {
    const supabaseUser = await createClientFromRequest(request);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (!user) {
      console.warn(`[rolepitch/claim-critique ${rid}] 401: no user`, { auth_err: userErr?.message || null });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[rolepitch/claim-critique ${rid}] user`, { user_id: user.id, email: user.email });

    const { critique_id } = await request.json().catch((e) => {
      console.warn(`[rolepitch/claim-critique ${rid}] body parse failed`, { message: e?.message });
      return {};
    });
    console.log(`[rolepitch/claim-critique ${rid}] payload`, { critique_id: critique_id || null });

    const service = createServiceClient();

    let claimed = 0;
    let claimedBy = null;
    let claimedPdfPath = null;

    if (critique_id) {
      const { data, error } = await service
        .from('rp_critiques')
        .update({ user_id: user.id })
        .eq('id', critique_id)
        .is('user_id', null)
        .gt('expires_at', new Date().toISOString())
        .select('id, pdf_path');
      if (error) {
        console.error(`[rolepitch/claim-critique ${rid}] update by id error`, { message: error.message, code: error.code });
      } else if (data?.length) {
        claimed = data.length;
        claimedBy = 'id';
        claimedPdfPath = data[0]?.pdf_path || null;
      }
    }

    if (claimed === 0 && user.email) {
      const { data, error } = await service
        .from('rp_critiques')
        .update({ user_id: user.id })
        .eq('email', user.email)
        .is('user_id', null)
        .gt('expires_at', new Date().toISOString())
        .select('id, pdf_path');
      if (error) {
        console.error(`[rolepitch/claim-critique ${rid}] update by email error`, { message: error.message, code: error.code });
      } else if (data?.length) {
        claimed = data.length;
        claimedBy = 'email';
        claimedPdfPath = data[0]?.pdf_path || null;
      }
    }

    // Propagate the stored PDF path to profiles so download-pdf can later
    // run vision capture and serve a layout-preserving merge.
    if (claimed && claimedPdfPath) {
      const { error: profErr } = await service
        .from('profiles')
        .update({ original_pdf_path: claimedPdfPath })
        .eq('user_id', user.id)
        .is('original_pdf_path', null);
      if (profErr) {
        console.warn(`[rolepitch/claim-critique ${rid}] profile pdf_path mirror failed (non-fatal)`, { message: profErr.message });
      } else {
        console.log(`[rolepitch/claim-critique ${rid}] mirrored pdf_path to profile`, { pdf_path: claimedPdfPath });
      }
    }

    console.log(`[rolepitch/claim-critique ${rid}] DONE 200`, { total_ms: Date.now() - t0, claimed, claimed_by: claimedBy, has_pdf: !!claimedPdfPath });
    return NextResponse.json({ claimed });
  } catch (err) {
    console.error(`[rolepitch/claim-critique ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
