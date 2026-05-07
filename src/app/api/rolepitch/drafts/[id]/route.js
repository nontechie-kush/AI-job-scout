/**
 * GET    /api/rolepitch/drafts/:id  — fetch draft (anon if user_id IS NULL, else owner-only)
 * PATCH  /api/rolepitch/drafts/:id  — update draft fields
 *
 * Allowed PATCH fields: parsed_resume, parsed_source, email, jd_id,
 *                       jd_snapshot, tailored, before_score, after_score,
 *                       gap_questions, gap_answers
 *
 * Anonymous draft updates use the service client (no auth needed) but only
 * succeed if the row is unclaimed and unexpired (RLS + WHERE clause).
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = new Set([
  'parsed_resume', 'parsed_source', 'email',
  'jd_id', 'jd_snapshot',
  'tailored', 'before_score', 'after_score',
  'gap_questions', 'gap_answers',
  'pdf_path',
]);

const ALLOWED_SOURCES = new Set(['pdf', 'website', 'text', 'linkedin_pdf', 'image']);

function makeRid() {
  return `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET(request, { params }) {
  const rid = makeRid();
  const { id } = await params;
  console.log(`[rolepitch/drafts/:id ${rid}] GET`, { id });
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from('rp_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error(`[rolepitch/drafts/:id ${rid}] db error`, { message: error.message });
      return NextResponse.json({ error: error.message, rid }, { status: 500 });
    }
    if (!data) {
      console.warn(`[rolepitch/drafts/:id ${rid}] 404: not found`);
      return NextResponse.json({ error: 'Draft not found', rid }, { status: 404 });
    }
    if (new Date(data.expires_at) < new Date()) {
      console.warn(`[rolepitch/drafts/:id ${rid}] 410: expired`, { expires_at: data.expires_at });
      return NextResponse.json({ error: 'Draft expired', rid }, { status: 410 });
    }
    // If claimed, only the owner can read.
    if (data.user_id) {
      const userClient = await createClientFromRequest(request);
      const { data: { user } } = await userClient.auth.getUser();
      if (!user || user.id !== data.user_id) {
        console.warn(`[rolepitch/drafts/:id ${rid}] 403: claimed but not owner`);
        return NextResponse.json({ error: 'Forbidden', rid }, { status: 403 });
      }
    }
    return NextResponse.json({ draft: data });
  } catch (err) {
    console.error(`[rolepitch/drafts/:id ${rid}] GET uncaught`, { message: err?.message });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const rid = makeRid();
  const { id } = await params;
  console.log(`[rolepitch/drafts/:id ${rid}] PATCH`, { id });
  try {
    const body = await request.json().catch(() => ({}));
    const patch = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(k)) patch[k] = v;
    }
    if (patch.parsed_source && !ALLOWED_SOURCES.has(patch.parsed_source)) {
      console.warn(`[rolepitch/drafts/:id ${rid}] 400: invalid parsed_source`, { value: patch.parsed_source });
      return NextResponse.json({ error: 'Invalid parsed_source', rid }, { status: 400 });
    }
    if (Object.keys(patch).length === 0) {
      console.warn(`[rolepitch/drafts/:id ${rid}] 400: no allowed fields`, { received: Object.keys(body) });
      return NextResponse.json({ error: 'No allowed fields in body', rid }, { status: 400 });
    }
    console.log(`[rolepitch/drafts/:id ${rid}] applying patch`, { fields: Object.keys(patch) });

    const service = createServiceClient();
    // Only update if the draft is still in 'draft' status (unclaimed + not expired).
    const { data, error } = await service
      .from('rp_drafts')
      .update(patch)
      .eq('id', id)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .select('id, updated_at')
      .maybeSingle();
    if (error) {
      console.error(`[rolepitch/drafts/:id ${rid}] update error`, {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json({ error: error.message, rid }, { status: 500 });
    }
    if (!data) {
      console.warn(`[rolepitch/drafts/:id ${rid}] 410: draft not updatable (claimed/expired/missing)`);
      return NextResponse.json({ error: 'Draft not updatable', rid }, { status: 410 });
    }
    console.log(`[rolepitch/drafts/:id ${rid}] DONE`, { updated_at: data.updated_at });
    return NextResponse.json({ ok: true, updated_at: data.updated_at });
  } catch (err) {
    console.error(`[rolepitch/drafts/:id ${rid}] PATCH uncaught`, { message: err?.message });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
