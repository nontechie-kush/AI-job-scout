/**
 * POST /api/rolepitch/base-resume
 *
 * Saves a signed-in user's latest base/source resume. This creates a new
 * profiles row so future tailoring uses it, while old tailored resumes remain
 * historical snapshots.
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
    .select('id, source, parsed_at, parsed_json, structured_resume, original_html, original_pdf_path')
    .eq('user_id', user.id)
    .order('parsed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ base_resume: data ? summarizeBaseResume(data) : null });
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

    const { data: row, error } = await service
      .from('profiles')
      .insert({
        user_id: user.id,
        raw_text: '',
        source,
        parsed_json: parsed,
        structured_resume,
        parsed_at: new Date().toISOString(),
        claude_model: 'claude-opus-4-6',
        original_pdf_path: pdfPath || null,
      })
      .select('id, source, parsed_at, parsed_json, structured_resume, original_html, original_pdf_path')
      .single();

    if (error) {
      console.error(`[rolepitch/base-resume ${rid}] profile insert failed`, {
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
      has_pdf_path: !!pdfPath,
      experience_count: parsed.experience?.length || 0,
    });

    return NextResponse.json({ ok: true, base_resume: summarizeBaseResume(row) });
  } catch (err) {
    console.error(`[rolepitch/base-resume ${rid}] uncaught`, { message: err?.message });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
