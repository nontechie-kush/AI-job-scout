/**
 * GET /api/rolepitch/download-pdf?tailored_resume_id=xxx
 *
 * Promise:
 *   - Initially tailored resumes preserve the user's original CV layout.
 *   - Manually edited resumes render deterministically from edited_version, so
 *     every user edit appears exactly in the downloaded PDF.
 *
 * If we can't preserve original layout for a non-edited resume, we refuse — we
 * never silently fall back to the generic Georgia template. The client uses the
 * 409 to prompt a reupload.
 *
 * Pipeline:
 *   1. If edited_version exists → render edited JSON directly, cache, serve.
 *   2. If tailored_resumes.tailored_html is cached AND vision-merged → serve it.
 *      (Cached fast-template HTML is treated as a miss — see isFastTemplate.)
 *   3. If profile has original_html → run Sonnet merge, cache, serve.
 *   4. If profile has only original_pdf_path (vision never ran) → fetch PDF,
 *      run Gemini vision, write original_html to profile, then merge + cache.
 *   5. If we have neither → respond 409 LAYOUT_UNAVAILABLE so the client can
 *      route the user to /rolepitch/start to recapture their PDF.
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { renderTailoredHtml } from '@/lib/ai/render-tailored-html';
import { renderEditedResumeHtml } from '@/lib/ai/render-edited-resume-html';
import { pdfToVisionHtml } from '@/lib/ai/vision-to-html';

// Detects HTML from buildFastHtml() — fast template uses Georgia + a known
// page-padding signature. Anything else (vision-merged, Times New Roman,
// .page wrapper) is considered a layout-preserving render and reusable.
function isFastTemplate(html) {
  if (!html) return false;
  const head = html.slice(0, 1500);
  return /font-family:'Georgia',serif/.test(head) && !/class="page"/.test(html);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function makeSafeFilename(name, role) {
  const sanitize = str => (str || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  return [sanitize(name), sanitize(role)].filter(Boolean).join('_') || 'Resume';
}

function cacheKeyFor(tr) {
  if (!tr?.edited_version) return 'tailored';
  const digest = createHash('sha256')
    .update(JSON.stringify(tr.edited_version))
    .digest('hex')
    .slice(0, 16);
  return `edited:${digest}`;
}

function withCacheMarker(html, key) {
  return `<!-- rolepitch-cache-key:${key} -->\n${html || ''}`;
}

function hasCacheMarker(html, key) {
  return typeof html === 'string' && html.startsWith(`<!-- rolepitch-cache-key:${key} -->`);
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tailoredResumeId = searchParams.get('tailored_resume_id');
    if (!tailoredResumeId) return NextResponse.json({ error: 'tailored_resume_id required' }, { status: 400 });

    let [{ data: tr, error: trErr }, { data: profileRow }] = await Promise.all([
      supabase
        .from('tailored_resumes')
        .select('tailored_version, edited_version, edited_at, edit_count, base_version, jd_id, match_id, tailored_html')
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

    if (trErr?.message?.includes('edited_version')) {
      const legacy = await supabase
        .from('tailored_resumes')
        .select('tailored_version, base_version, jd_id, match_id, tailored_html')
        .eq('id', tailoredResumeId)
        .eq('user_id', user.id)
        .maybeSingle();
      tr = legacy.data;
      trErr = legacy.error;
    }

    if (trErr || !tr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

    const tv = tr.edited_version || tr.tailored_version || {};
    const bv = tr.base_version || {};

    // Resolve name/contact — edited/tailored version → base_version → profile fallback.
    let profileName = '', profileContact = {};
    if (!tv.name && !bv.name) {
      profileName = profileRow?.structured_resume?.name || '';
      profileContact = profileRow?.structured_resume?.contact || {};
    }

    const mergedResume = {
      name: tv.name || bv.name || profileName,
      title: tv.title || tv.headline || bv.title || bv.headline || jdTitle || '',
      headline: tv.headline || tv.title || bv.headline || bv.title || jdTitle || '',
      contact: (tv.contact && Object.keys(tv.contact).length > 0)
        ? tv.contact
        : (bv.contact && Object.keys(bv.contact).length > 0 ? bv.contact : profileContact),
      summary: tv.summary || bv.summary || '',
      experience: tv.experience || bv.experience || [],
      education: tv.education || bv.education || [],
      skills: tv.skills || bv.skills || [],
    };

    const cacheKey = cacheKeyFor(tr);
    const service = createServiceClient();

    // Manual edits are deterministic. Once a user edits text themselves, the
    // saved edited_version JSON is the product promise, not AI layout recovery.
    if (tr.edited_version) {
      const cacheIsCurrent = hasCacheMarker(tr.tailored_html, cacheKey);
      if (cacheIsCurrent && tr.tailored_html && !isFastTemplate(tr.tailored_html)) {
        const cachedFilename = makeSafeFilename(mergedResume.name, jdTitle);
        return new Response(tr.tailored_html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${cachedFilename}.pdf"`,
          },
        });
      }

      const renderedHtml = renderEditedResumeHtml({ resume: mergedResume, jobTitle: jdTitle });
      const finalHtml = withCacheMarker(renderedHtml, cacheKey);

      try {
        await service
          .from('tailored_resumes')
          .update({ tailored_html: finalHtml })
          .eq('id', tailoredResumeId);
      } catch (e) {
        console.warn('[download-pdf] edited cache write failed (non-fatal)', { message: e?.message });
      }

      const filename = makeSafeFilename(mergedResume.name, jdTitle);
      return new Response(finalHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    // ── Fast path: cached HTML (vision-merged only — fast template is treated as a miss) ──
    if (tr.tailored_html && !isFastTemplate(tr.tailored_html)) {
      const cachedFilename = makeSafeFilename(
        (tr.tailored_version?.name || tr.base_version?.name || ''),
        jdTitle,
      );
      return new Response(tr.tailored_html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${cachedFilename}.pdf"`,
        },
      });
    }

    // ── Try to recover original_html if missing but a PDF is on file ──
    let originalHtml = profileRow?.original_html || null;
    let originalPageCount = profileRow?.original_page_count || 1;
    const originalPdfPath = profileRow?.original_pdf_path || null;

    if (!originalHtml && originalPdfPath) {
      try {
        const { data: pdfBlob } = await service.storage.from('resumes').download(originalPdfPath);
        if (pdfBlob) {
          const buffer = Buffer.from(await pdfBlob.arrayBuffer());
          const { html, pageCount } = await pdfToVisionHtml(buffer);
          originalHtml = html;
          originalPageCount = pageCount;
          await service.from('profiles').update({
            original_html: html,
            original_page_count: pageCount,
          }).eq('user_id', user.id);
          console.log('[download-pdf] vision recovered from stored PDF', { pageCount });
        }
      } catch (e) {
        console.warn('[download-pdf] vision recovery failed', { message: e?.message });
      }
    }

    // ── Refuse if we can't keep the layout-preserving promise ──
    if (!originalHtml) {
      console.warn('[download-pdf] layout unavailable', {
        user_id: user.id,
        has_pdf_path: !!originalPdfPath,
      });
      // Browser navigation (window.open / direct visit) → redirect to the
      // reupload flow so users never see a raw JSON error page.
      // Programmatic clients (probes from the dashboard, fetch with Accept:
      // application/json) get the structured 409 they can branch on.
      const accept = request.headers.get('accept') || '';
      const wantsJson = accept.includes('application/json') && !accept.includes('text/html');
      const reuploadUrl = `/rolepitch/start?reupload=1&for=${encodeURIComponent(tailoredResumeId)}`;
      if (wantsJson) {
        return NextResponse.json({
          error: 'LAYOUT_UNAVAILABLE',
          message: "We don't have your original CV layout on file yet. Reupload your resume to get a layout-preserving PDF.",
          reupload_url: reuploadUrl,
        }, { status: 409 });
      }
      return NextResponse.redirect(new URL(reuploadUrl, request.url), 302);
    }

    // Vision-merged path only — buildFastHtml is intentionally NOT passed.
    // renderTailoredHtml falls back to it when buildFastHtml is provided AND
    // originalHtml is null. Above we've already 409'd in that case, so by
    // here originalHtml is guaranteed truthy.
    const renderedHtml = await renderTailoredHtml({
      originalHtml,
      pageCount: originalPageCount,
      mergedResume,
      jobContext: { title: jdTitle, company: jdCompany, description: jdDescription },
      buildFastHtml: () => { throw new Error('fast template disabled in download-pdf'); },
    });

    const finalHtml = withCacheMarker(renderedHtml, cacheKey);

    // Persist for instant subsequent downloads
    try {
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
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[download-pdf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
