/**
 * GET /api/rolepitch/download-pdf?tailored_resume_id=xxx
 *
 * Pipeline:
 *   1. If tailored_resumes.tailored_html is cached → serve it instantly.
 *   2. Otherwise render once: vision-merge into original_html when available,
 *      else fall back to the fast Georgia template.
 *   3. Persist the result on the row so subsequent downloads are instant.
 *      The pre-render also runs proactively in claim-draft when possible.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { renderTailoredHtml } from '@/lib/ai/render-tailored-html';
import { buildFastHtml } from '@/lib/ai/build-fast-html';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function makeSafeFilename(name, role) {
  const sanitize = str => (str || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  return [sanitize(name), sanitize(role)].filter(Boolean).join('_') || 'Resume';
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tailoredResumeId = searchParams.get('tailored_resume_id');
    if (!tailoredResumeId) return NextResponse.json({ error: 'tailored_resume_id required' }, { status: 400 });

    const [{ data: tr, error: trErr }, { data: profileRow }] = await Promise.all([
      supabase
        .from('tailored_resumes')
        .select('tailored_version, base_version, jd_id, match_id, tailored_html')
        .eq('id', tailoredResumeId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('parsed_json, structured_resume, original_html, original_page_count, original_pdf_path')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle(),
    ]);

    if (trErr || !tr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // ── Fast path: pre-rendered HTML cached on the row ──────────────────
    if (tr.tailored_html) {
      const cachedFilename = makeSafeFilename(
        (tr.tailored_version?.name || tr.base_version?.name || ''),
        '',
      );
      return new Response(tr.tailored_html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${cachedFilename}.pdf"`,
        },
      });
    }

    let jdTitle = '', jdCompany = '', jdDescription = '';
    if (tr.jd_id) {
      const { data: jd } = await supabase
        .from('job_descriptions')
        .select('title, company, description')
        .eq('id', tr.jd_id)
        .maybeSingle();
      jdTitle = jd?.title || '';
      jdCompany = jd?.company || '';
      jdDescription = (jd?.description || '').slice(0, 3000);
    }

    const tv = tr.tailored_version || {};
    const bv = tr.base_version || {};

    // Resolve name/contact — tailored_version → base_version → profile fallback
    let profileName = '', profileContact = {};
    if (!tv.name && !bv.name) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('structured_resume')
        .eq('user_id', user.id)
        .maybeSingle();
      profileName = prof?.structured_resume?.name || '';
      profileContact = prof?.structured_resume?.contact || {};
    }

    const mergedResume = {
      name: tv.name || bv.name || profileName,
      contact: (tv.contact && Object.keys(tv.contact).length > 0)
        ? tv.contact
        : (bv.contact && Object.keys(bv.contact).length > 0 ? bv.contact : profileContact),
      summary: tv.summary || bv.summary || '',
      experience: tv.experience || bv.experience || [],
      education: tv.education || bv.education || [],
      skills: tv.skills || bv.skills || [],
    };

    // ── Render once: vision-merged HTML when original_html exists, fast template otherwise ──
    const finalHtml = await renderTailoredHtml({
      originalHtml: profileRow?.original_html || null,
      pageCount: profileRow?.original_page_count || 1,
      mergedResume,
      jobContext: { title: jdTitle, company: jdCompany, description: jdDescription },
      buildFastHtml,
    });

    // Persist for instant subsequent downloads — service client bypasses RLS
    try {
      const service = createServiceClient();
      await service
        .from('tailored_resumes')
        .update({ tailored_html: finalHtml })
        .eq('id', tailoredResumeId);
    } catch (e) {
      console.warn('[download-pdf] cache write failed (non-fatal)', { message: e?.message });
    }

    const filename = makeSafeFilename(mergedResume.name, jdTitle);

    return new Response(finalHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[download-pdf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
