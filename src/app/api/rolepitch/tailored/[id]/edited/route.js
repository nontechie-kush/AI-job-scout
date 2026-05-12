/**
 * GET /api/rolepitch/tailored/:id/edited
 * PUT /api/rolepitch/tailored/:id/edited
 *
 * Editor API for user-authored resume tweaks after the first tailored PDF.
 * `tailored_version` stays as the original AI output; `edited_version` stores
 * the user's self-edited resume and wins during download.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function normalizeBullet(b) {
  if (typeof b === 'string') return { text: b, type: 'achievement' };
  if (!b || typeof b !== 'object') return { text: '', type: 'achievement' };
  return {
    ...b,
    text: typeof b.text === 'string' ? b.text : '',
    type: b.type || 'achievement',
  };
}

function normalizeResume(input = {}, fallback = {}) {
  const source = input || {};
  const fb = fallback || {};
  return {
    name: source.name || fb.name || '',
    title: source.title || fb.title || '',
    contact: {
      ...(fb.contact || {}),
      ...(source.contact || {}),
    },
    summary: source.summary || fb.summary || '',
    experience: (Array.isArray(source.experience) ? source.experience : fb.experience || []).map((role) => ({
      title: role?.title || '',
      company: role?.company || '',
      location: role?.location || '',
      start_date: role?.start_date || null,
      end_date: role?.end_date || null,
      bullets: (role?.bullets || []).map(normalizeBullet).filter((b) => b.text.trim()),
    })),
    education: (Array.isArray(source.education) ? source.education : fb.education || []).map((ed) => ({
      degree: ed?.degree || '',
      institution: ed?.institution || '',
      location: ed?.location || '',
      start_date: ed?.start_date || null,
      end_date: ed?.end_date || null,
    })),
    skills: Array.isArray(source.skills) ? source.skills.filter(Boolean) : (fb.skills || []),
    before_score: source.before_score ?? fb.before_score,
    after_score: source.after_score ?? fb.after_score,
    highlights_used: source.highlights_used ?? fb.highlights_used,
    bullets_rewritten: source.bullets_rewritten ?? fb.bullets_rewritten,
    auto_tailored: source.auto_tailored ?? fb.auto_tailored,
    source_draft_id: source.source_draft_id ?? fb.source_draft_id,
    source_critique_id: source.source_critique_id ?? fb.source_critique_id,
    source_mode: source.source_mode ?? fb.source_mode,
    source_label: source.source_label ?? fb.source_label,
  };
}

function mergeEditable({ editedVersion, tailoredVersion, baseVersion, profileStructured }) {
  const base = normalizeResume(baseVersion || profileStructured || {});
  const tailored = normalizeResume(tailoredVersion || {}, base);
  return normalizeResume(editedVersion || tailored, tailored);
}

async function loadEditorData(supabase, userId, id) {
  let [{ data: tr, error: trErr }, { data: profileRow }] = await Promise.all([
    supabase
      .from('tailored_resumes')
      .select('id, user_id, jd_id, base_version, tailored_version, edited_version, edited_at, edit_count, tailored_html, pipeline_version, resume_strength, updated_at, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('structured_resume, original_html, original_pdf_path, parsed_at')
      .eq('user_id', userId)
      .order('parsed_at', { ascending: false })
      .maybeSingle(),
  ]);

  let migrationRequired = false;
  if (trErr?.message?.includes('edited_version') || trErr?.message?.includes('edited_at') || trErr?.message?.includes('edit_count')) {
    migrationRequired = true;
    const legacy = await supabase
      .from('tailored_resumes')
      .select('id, user_id, jd_id, base_version, tailored_version, tailored_html, pipeline_version, resume_strength, updated_at, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    tr = legacy.data;
    trErr = legacy.error;
  }

  if (trErr || !tr) return { error: 'Tailored resume not found' };

  let jd = { title: 'Untitled role', company: '', description: '' };
  if (tr.jd_id) {
    const { data } = await supabase
      .from('job_descriptions')
      .select('title, company, description')
      .eq('id', tr.jd_id)
      .maybeSingle();
    jd = {
      title: data?.title || 'Untitled role',
      company: data?.company || '',
      description: data?.description || '',
    };
  }

  const editable = mergeEditable({
    editedVersion: tr.edited_version,
    tailoredVersion: tr.tailored_version,
    baseVersion: tr.base_version,
    profileStructured: profileRow?.structured_resume,
  });

  return {
    tr,
    response: {
      id: tr.id,
      jd,
      resume: editable,
      has_edits: !!tr.edited_version,
      edited_at: tr.edited_at,
      edit_count: tr.edit_count || 0,
      updated_at: tr.updated_at,
      created_at: tr.created_at,
      layout_available: !!(profileRow?.original_html || profileRow?.original_pdf_path),
      migration_required: migrationRequired,
    },
  };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const loaded = await loadEditorData(supabase, user.id, id);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: 404 });

    return NextResponse.json(loaded.response);
  } catch (err) {
    console.error('[rolepitch/tailored/:id/edited GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (!body.resume || typeof body.resume !== 'object') {
      return NextResponse.json({ error: 'resume object required' }, { status: 400 });
    }

    const loaded = await loadEditorData(supabase, user.id, id);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: 404 });
    if (loaded.response.migration_required) {
      return NextResponse.json({
        error: 'MIGRATION_REQUIRED',
        message: 'Resume editing needs the RolePitch editor database migration before it can save edits.',
        ...loaded.response,
      }, { status: 503 });
    }

    const editedVersion = normalizeResume(body.resume, loaded.response.resume);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tailored_resumes')
      .update({
        edited_version: editedVersion,
        edited_at: now,
        edit_count: (loaded.tr.edit_count || 0) + 1,
        tailored_html: null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('updated_at, edited_at, edit_count')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      resume: editedVersion,
      updated_at: data?.updated_at || now,
      edited_at: data?.edited_at || now,
      edit_count: data?.edit_count || ((loaded.tr.edit_count || 0) + 1),
    });
  } catch (err) {
    console.error('[rolepitch/tailored/:id/edited PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
