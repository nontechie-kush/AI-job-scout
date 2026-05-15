/**
 * POST /api/rolepitch/base-resume
 *
 * Saves a signed-in user's latest base/source resume. Production has a unique
 * profiles.user_id constraint, so the user's profile row is updated in place.
 * Old tailored resumes remain historical snapshots because their base_version
 * is stored on tailored_resumes.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { buildStructuredResume, summarizeBaseResume } from '@/lib/rolepitch/resume';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_SOURCES = new Set(['pdf', 'website', 'text', 'linkedin_pdf', 'image']);

function makeRid() {
  return `br_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET(request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('profiles')
    .select('id, source, parsed_at, parsed_json, structured_resume, original_html, original_page_count, original_pdf_path')
    .eq('user_id', user.id)
    .order('parsed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    base_resume: data ? summarizeBaseResume(data) : null,
    resume: data ? buildStructuredResume(data.structured_resume || data.parsed_json || {}) : null,
  });
}

export async function POST(request) {
  const rid = makeRid();
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { parsed, source: rawSource, pdf_path: pdfPath } = await request.json();
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'parsed resume required' }, { status: 400 });
    }

    const service = createServiceClient();
    const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : 'text';
    const structured_resume = buildStructuredResume(parsed);
    const now = new Date().toISOString();

    const { data: current } = await service
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      raw_text: '',
      source,
      parsed_json: parsed,
      structured_resume,
      parsed_at: now,
      claude_model: 'claude-opus-4-6',
      original_html: null,
      original_page_count: null,
      original_pdf_path: pdfPath || null,
    };

    const write = current?.id
      ? service
          .from('profiles')
          .update(payload)
          .eq('id', current.id)
      : service
          .from('profiles')
          .insert({
            user_id: user.id,
            ...payload,
          });

    const { data: row, error } = await write
      .select('id, source, parsed_at, parsed_json, structured_resume, original_html, original_pdf_path')
      .single();

    if (error) {
      console.error(`[rolepitch/base-resume ${rid}] profile write failed`, {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json({ error: error.message, rid }, { status: 500 });
    }

    console.log(`[rolepitch/base-resume ${rid}] updated`, {
      user_id: user.id,
      profile_id: row.id,
      source,
      mode: current?.id ? 'update' : 'insert',
      has_pdf_path: !!pdfPath,
      experience_count: parsed.experience?.length || 0,
    });

    return NextResponse.json({ ok: true, base_resume: summarizeBaseResume(row) });
  } catch (err) {
    console.error(`[rolepitch/base-resume ${rid}] uncaught`, { message: err?.message });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}

export async function PATCH(request) {
  const rid = makeRid();
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { resume, preferences = {}, update_note = '' } = await request.json().catch(() => ({}));
    if (!resume || typeof resume !== 'object') {
      return NextResponse.json({ error: 'resume object required' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: current, error: readErr } = await service
      .from('profiles')
      .select('id, source, parsed_json, structured_resume, original_html, original_page_count, original_pdf_path')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readErr) return NextResponse.json({ error: readErr.message, rid }, { status: 500 });
    if (!current) return NextResponse.json({ error: 'No base resume found', rid }, { status: 404 });

    const structured_resume = buildStructuredResume(resume);
    const parsed_json = {
      ...(current.parsed_json || {}),
      ...structured_resume,
      education_detail: structured_resume.education,
      rolepitch_base_update: {
        mode: 'chat',
        keep_design: preferences.keep_design !== 'no',
        page_preference: preferences.page_preference === 'flexible' ? 'flexible' : 'one_page',
        update_note: String(update_note || '').slice(0, 1000),
        updated_at: new Date().toISOString(),
      },
    };

    const { data: row, error } = await service
      .from('profiles')
      .update({
        user_id: user.id,
        raw_text: '',
        source: current.source || 'text',
        parsed_json,
        structured_resume,
        parsed_at: new Date().toISOString(),
        claude_model: 'claude-sonnet-4-5-20250929',
        original_html: current.original_html || null,
        original_page_count: current.original_page_count || null,
        original_pdf_path: current.original_pdf_path || null,
      })
      .eq('id', current.id)
      .select('id, source, parsed_at, parsed_json, structured_resume, original_html, original_pdf_path')
      .single();

    if (error) {
      console.error(`[rolepitch/base-resume ${rid}] manual update failed`, {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json({ error: error.message, rid }, { status: 500 });
    }

    console.log(`[rolepitch/base-resume ${rid}] manual update saved`, {
      user_id: user.id,
      profile_id: row.id,
      keep_design: preferences.keep_design !== 'no',
      page_preference: preferences.page_preference || 'one_page',
    });

    return NextResponse.json({
      ok: true,
      base_resume: summarizeBaseResume(row),
      resume: structured_resume,
    });
  } catch (err) {
    console.error(`[rolepitch/base-resume ${rid}] patch uncaught`, { message: err?.message });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
