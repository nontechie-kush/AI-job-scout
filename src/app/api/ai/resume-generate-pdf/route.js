/**
 * POST /api/ai/resume-generate-pdf
 *
 * Body: { tailored_resume_id: string }
 *
 * Pipeline:
 *   1. Load tailored_resumes row + profile (original_html, parsed_json, structured_resume).
 *   2. If profile lacks original_html, fall back to jsonToFallbackHtml (clean generic template).
 *   3. Ask Claude to merge tailored_version content into the original HTML, preserving design + page count.
 *   4. POST resulting HTML to self-hosted pdf-service /html-to-pdf.
 *   5. Upload PDF buffer to Supabase Storage, return signed URL.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { htmlToPdf } from '@/lib/pdf-service';
import { jsonToFallbackHtml, pdfToVisionHtml } from '@/lib/ai/vision-to-html';
import { buildResumeHtmlTailorPrompt } from '@/lib/ai/prompts/resume-html-tailor';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripFences(html) {
  return html
    .replace(/^\s*```(?:html)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim();
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tailored_resume_id } = await request.json();
    if (!tailored_resume_id) {
      return NextResponse.json({ error: 'tailored_resume_id required' }, { status: 400 });
    }

    const [{ data: tailored }, { data: profileRow }] = await Promise.all([
      supabase
        .from('tailored_resumes')
        .select('id, tailored_version, match_id')
        .eq('id', tailored_resume_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('parsed_json, structured_resume, original_html, original_page_count, original_pdf_path')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle(),
    ]);

    if (!tailored) {
      return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });
    }

    let jobContext = { title: '', company: '', description: '' };
    if (tailored.match_id) {
      const { data: matchRow } = await supabase
        .from('job_matches')
        .select('jobs(title, company, description)')
        .eq('id', tailored.match_id)
        .maybeSingle();
      if (matchRow?.jobs) {
        jobContext = {
          title: matchRow.jobs.title || '',
          company: matchRow.jobs.company || '',
          description: (matchRow.jobs.description || '').slice(0, 3000),
        };
      }
    }

    let originalHtml = profileRow?.original_html || null;
    let pageCount = profileRow?.original_page_count || 1;

    // Lazy backfill: if no original_html but we have the original PDF in Storage,
    // run vision now so future calls are fast.
    if (!originalHtml && profileRow?.original_pdf_path) {
      try {
        const serviceClient = createServiceClient();
        const { data: pdfBlob } = await serviceClient.storage
          .from('resumes')
          .download(profileRow.original_pdf_path);
        if (pdfBlob) {
          const buffer = Buffer.from(await pdfBlob.arrayBuffer());
          const visionResult = await pdfToVisionHtml(buffer);
          originalHtml = visionResult.html;
          pageCount = visionResult.pageCount;
          await supabase
            .from('profiles')
            .update({
              original_html: originalHtml,
              original_page_count: pageCount,
            })
            .eq('user_id', user.id);
        }
      } catch (e) {
        console.error('[resume-generate-pdf] lazy vision backfill failed:', e.message);
      }
    }

    // Final fallback: build a clean generic template from parsed JSON.
    if (!originalHtml) {
      const fallback = await jsonToFallbackHtml(
        profileRow?.parsed_json || {},
        profileRow?.structured_resume || tailored.tailored_version
      );
      originalHtml = fallback.html;
      pageCount = fallback.pageCount;
    }

    // Ask Claude to apply tailored content to the original HTML design.
    const { system, user: userPrompt } = buildResumeHtmlTailorPrompt({
      originalHtml,
      pageCount,
      tailoredVersion: tailored.tailored_version,
      jobContext,
    });

    const tailorMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const finalHtml = stripFences(tailorMsg.content[0].text);

    if (!finalHtml.toLowerCase().includes('<!doctype')) {
      console.error('[resume-generate-pdf] tailor returned malformed HTML:', finalHtml.slice(0, 200));
      return NextResponse.json({ error: 'Resume render failed. Try again.' }, { status: 500 });
    }

    const pdfBuffer = await htmlToPdf(finalHtml, { format: 'Letter' });

    const serviceClient = createServiceClient();
    const storagePath = `${user.id}/resume-${tailored_resume_id}.pdf`;
    const { error: uploadError } = await serviceClient.storage
      .from('resumes')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`PDF upload failed: ${uploadError.message}`);
    }

    const { data: signedUrlData } = await serviceClient.storage
      .from('resumes')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60);
    const pdfUrl = signedUrlData?.signedUrl;

    await supabase
      .from('tailored_resumes')
      .update({
        pdf_url: pdfUrl,
        status: 'finalized',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tailored_resume_id);

    return NextResponse.json({ pdf_url: pdfUrl });
  } catch (err) {
    console.error('[resume-generate-pdf]', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
