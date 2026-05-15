/**
 * GET /api/rolepitch/base-resume/download
 *
 * Downloads the user's current base/source resume. This never deducts credits:
 * the base resume is the user's source of truth, not a new pitch.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { renderTailoredHtml } from '@/lib/ai/render-tailored-html';
import { renderEditedResumeHtml } from '@/lib/ai/render-edited-resume-html';
import { pdfToVisionHtml } from '@/lib/ai/vision-to-html';
import { htmlToPdf } from '@/lib/pdf-service';
import { buildStructuredResume } from '@/lib/rolepitch/resume';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function safeFilename(name) {
  const cleaned = String(name || 'Base_Resume')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `${cleaned || 'Base_Resume'}_Base_Resume`;
}

async function pdfAttachmentResponse(html, filename) {
  const pdfBuffer = await htmlToPdf(html, { format: 'Letter' });
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceClient();
    const { data: profile, error } = await service
      .from('profiles')
      .select('structured_resume, parsed_json, original_html, original_page_count, original_pdf_path')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!profile) return NextResponse.json({ error: 'No base resume found' }, { status: 404 });

    const resume = buildStructuredResume(profile.structured_resume || profile.parsed_json || {});
    let originalHtml = profile.original_html || null;
    let originalPageCount = profile.original_page_count || 1;
    const originalPdfPath = profile.original_pdf_path || null;

    if (!originalHtml && originalPdfPath) {
      try {
        const { data: pdfBlob } = await service.storage.from('resumes').download(originalPdfPath);
        if (pdfBlob) {
          const buffer = Buffer.from(await pdfBlob.arrayBuffer());
          const { html, pageCount } = await pdfToVisionHtml(buffer);
          originalHtml = html;
          originalPageCount = pageCount;
          await service
            .from('profiles')
            .update({ original_html: html, original_page_count: pageCount })
            .eq('user_id', user.id);
        }
      } catch (e) {
        console.warn('[base-resume/download] vision recovery failed', { message: e?.message });
      }
    }

    const fallbackHtml = () => renderEditedResumeHtml({ resume, jobTitle: resume.title || '' });
    const html = originalHtml
      ? await renderTailoredHtml({
          originalHtml,
          pageCount: originalPageCount,
          mergedResume: resume,
          jobContext: { title: resume.title || 'Base resume', company: '', description: '' },
          buildFastHtml: fallbackHtml,
        })
      : fallbackHtml();

    return pdfAttachmentResponse(html, safeFilename(resume.name));
  } catch (err) {
    console.error('[base-resume/download]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
