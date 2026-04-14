/**
 * POST /api/ai/resume-generate-pdf
 *
 * Body: { tailored_resume_id: string, template?: 'clean' }
 *
 * Generates a PDF from the tailored resume and uploads to Supabase Storage.
 * Returns: { pdf_url: string }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { CleanResumeTemplate } from '@/lib/resume/templates/clean';

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

    // Fetch the tailored resume + user profile for name
    const [{ data: tailored }, { data: profileRow }] = await Promise.all([
      supabase
        .from('tailored_resumes')
        .select('id, tailored_version')
        .eq('id', tailored_resume_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('parsed_json')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle(),
    ]);

    if (!tailored) {
      return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });
    }

    const resumeData = tailored.tailored_version;
    const userName = profileRow?.parsed_json?.name || '';

    // Render PDF to buffer
    const pdfBuffer = await renderToBuffer(
      React.createElement(CleanResumeTemplate, {
        resume: resumeData,
        name: userName,
      })
    );

    // Upload to Supabase Storage (use service client for storage access)
    const serviceClient = createServiceClient();
    const storagePath = `${user.id}/resume-${tailored_resume_id}.pdf`;

    const { error: uploadError } = await serviceClient.storage
      .from('resumes')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[resume-generate-pdf] upload error:', uploadError);
      throw new Error(`PDF upload failed: ${uploadError.message}`);
    }

    // Get signed URL (valid for 7 days)
    const { data: signedUrlData } = await serviceClient.storage
      .from('resumes')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

    const pdfUrl = signedUrlData?.signedUrl;

    // Update the tailored_resumes record
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
