/**
 * POST /api/rolepitch/drafts
 *
 * Creates an empty rp_drafts row and returns its id. Anonymous flow's
 * source-of-truth handle — replaces localStorage as the holder of in-flight
 * tailor state.
 *
 * Subsequent steps (parse-resume, init-match, tailor, chat-followup) PATCH
 * this row; signup claims it via /api/rolepitch/claim-draft.
 *
 * Body: {} (none required)
 * Returns: { draft_id, expires_at }
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

function makeRid() {
  return `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request) {
  const rid = makeRid();
  console.log(`[rolepitch/drafts ${rid}] CREATE`);
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from('rp_drafts')
      .insert({})
      .select('id, expires_at')
      .single();
    if (error) {
      console.error(`[rolepitch/drafts ${rid}] insert error`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ error: error.message, rid }, { status: 500 });
    }
    console.log(`[rolepitch/drafts ${rid}] created`, { draft_id: data.id });
    return NextResponse.json({ draft_id: data.id, expires_at: data.expires_at });
  } catch (err) {
    console.error(`[rolepitch/drafts ${rid}] uncaught`, { message: err?.message });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
