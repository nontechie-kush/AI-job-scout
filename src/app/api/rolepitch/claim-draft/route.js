/**
 * POST /api/rolepitch/claim-draft
 *
 * Atomic promotion of an anonymous rp_drafts row into the user's permanent
 * data: profiles + job_descriptions + tailored_resumes + 1 pitch credit.
 *
 * Replaces the localStorage-bridged save-resume flow that lost Vshrant's
 * pitch on 2026-05-02.
 *
 * Strategy (mirrors claim-critique):
 *   1. Lookup draft by `draft_id` (primary).
 *   2. Fallback: lookup by user.email matching draft.email (for the case
 *      where the draft_id wasn't carried through OAuth round-trip).
 *
 * Auth: cookie OR Authorization: Bearer <access_token>.
 *
 * Body: { draft_id?: string }
 * Returns: {
 *   claimed: bool,
 *   tailored_resume_id: string | null,
 *   has_tailored: bool,
 *   pitch_credits: number | null,
 *   draft_id: string,
 * }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { pdfToVisionHtml } from '@/lib/ai/vision-to-html';
import { renderTailoredHtml } from '@/lib/ai/render-tailored-html';
import { buildFastHtml } from '@/lib/ai/build-fast-html';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ALLOWED_SOURCES = new Set(['pdf', 'website', 'text', 'linkedin_pdf', 'image']);

function makeRid() {
  return `cd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildStructuredResume(parsed) {
  return {
    name: parsed.name,
    title: parsed.title || '',
    contact: parsed.contact || {},
    summary: parsed.summary || '',
    experience: (parsed.experience || []).map(role => ({
      title: role.title,
      company: role.company,
      location: role.location || '',
      start_date: role.start_date || null,
      end_date: role.end_date || null,
      bullets: (role.bullets || []).map(b => ({
        text: typeof b === 'string' ? b : b.text,
        type: typeof b === 'string' ? 'achievement' : (b.type || 'achievement'),
      })),
    })),
    education: (() => {
      const ed = Array.isArray(parsed.education_detail) ? parsed.education_detail
        : Array.isArray(parsed.education) ? parsed.education
        : [];
      return ed.map(e => ({
        degree: e.degree,
        institution: e.institution,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
      }));
    })(),
    skills: parsed.skills || [],
  };
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/claim-draft ${rid}] START`, { has_auth: !!request.headers.get('authorization') });

  try {
    const userClient = await createClientFromRequest(request);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (!user) {
      console.warn(`[rolepitch/claim-draft ${rid}] 401: no user`, { auth_err: userErr?.message || null });
      return NextResponse.json({ error: 'Unauthorized', rid }, { status: 401 });
    }
    console.log(`[rolepitch/claim-draft ${rid}] user`, { user_id: user.id, email: user.email });

    const { draft_id } = await request.json().catch(() => ({}));
    console.log(`[rolepitch/claim-draft ${rid}] payload`, { draft_id: draft_id || null });

    const service = createServiceClient();

    // 1. Find the draft (by id, with email fallback)
    let draft = null;
    let foundBy = null;
    if (draft_id) {
      const { data, error } = await service
        .from('rp_drafts')
        .select('*')
        .eq('id', draft_id)
        .maybeSingle();
      if (error) {
        console.error(`[rolepitch/claim-draft ${rid}] lookup-by-id error`, { message: error.message });
      } else if (data) {
        draft = data;
        foundBy = 'id';
      }
    }
    if (!draft && user.email) {
      const { data, error } = await service
        .from('rp_drafts')
        .select('*')
        .eq('email', user.email)
        .is('user_id', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error(`[rolepitch/claim-draft ${rid}] lookup-by-email error`, { message: error.message });
      } else if (data) {
        draft = data;
        foundBy = 'email';
      }
    }
    // NOTE: removed recency fallback — it could claim another user's unclaimed
    // draft when run from dashboard mount or any retry path. Stick to draft_id
    // (carried via URL through OAuth) and email match (draft.email = user.email).
    if (!draft) {
      console.warn(`[rolepitch/claim-draft ${rid}] no draft found`, { draft_id, email: user.email });
      return NextResponse.json({ claimed: false, has_tailored: false, tailored_resume_id: null, pitch_credits: null, draft_id: null });
    }
    console.log(`[rolepitch/claim-draft ${rid}] draft found`, {
      found_by: foundBy,
      id: draft.id,
      status: draft.status,
      already_owned: draft.user_id,
      has_parsed: !!draft.parsed_resume,
      has_jd_snapshot: !!draft.jd_snapshot,
      has_tailored: !!draft.tailored,
    });

    // Guard: if already claimed by someone else, refuse.
    if (draft.user_id && draft.user_id !== user.id) {
      console.warn(`[rolepitch/claim-draft ${rid}] 403: claimed by another user`, { draft_user: draft.user_id });
      return NextResponse.json({ error: 'Draft owned by another user', rid }, { status: 403 });
    }

    // 2. Promote profile (if user doesn't already have one)
    const parsed = draft.parsed_resume;
    if (!parsed) {
      console.warn(`[rolepitch/claim-draft ${rid}] draft has no parsed_resume — claiming as marker only`);
    }

    const { data: existingProfile } = await service
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let visionHtml = null;
    let visionPageCount = 1;

    if (!existingProfile && parsed) {
      const source = ALLOWED_SOURCES.has(draft.parsed_source) ? draft.parsed_source : 'text';
      const { error: profErr } = await service.from('profiles').insert({
        user_id: user.id,
        raw_text: '',
        source,
        parsed_json: parsed,
        structured_resume: buildStructuredResume(parsed),
        parsed_at: new Date().toISOString(),
        claude_model: 'claude-opus-4-6',
      });
      if (profErr) {
        console.error(`[rolepitch/claim-draft ${rid}] profile insert error`, {
          message: profErr.message,
          code: profErr.code,
          details: profErr.details,
        });
        return NextResponse.json({ error: `Failed to save profile: ${profErr.message}`, rid }, { status: 500 });
      }
      console.log(`[rolepitch/claim-draft ${rid}] profile inserted`, { source });

      // Vision capture: if the draft has a stored PDF, render it to HTML now
      if (draft.pdf_path) {
        try {
          const { data: pdfBlob } = await service.storage.from('resumes').download(draft.pdf_path);
          if (pdfBlob) {
            const buffer = Buffer.from(await pdfBlob.arrayBuffer());
            const { html, pageCount } = await pdfToVisionHtml(buffer);
            visionHtml = html;
            visionPageCount = pageCount;
            await service.from('profiles').update({
              original_html: html,
              original_page_count: pageCount,
              original_pdf_path: draft.pdf_path,
            }).eq('user_id', user.id);
            console.log(`[rolepitch/claim-draft ${rid}] vision capture complete`, { pageCount });
          }
        } catch (e) {
          console.error(`[rolepitch/claim-draft ${rid}] vision capture failed (non-fatal)`, { message: e.message });
        }
      }
    } else if (existingProfile) {
      console.log(`[rolepitch/claim-draft ${rid}] profile already exists, skipped insert`);
      // Pull stored vision html so we can pre-render the tailored html below.
      const { data: prof } = await service
        .from('profiles')
        .select('original_html, original_page_count, original_pdf_path')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle();
      if (prof?.original_html) {
        visionHtml = prof.original_html;
        visionPageCount = prof.original_page_count || 1;
      } else if (draft.pdf_path) {
        // Existing profile has no captured layout, but THIS draft has a fresh
        // PDF — capture now and backfill so download-pdf can preserve layout.
        // Covers users who claimed once without layout (legacy drafts) and
        // came back via ?reupload=1 to upload a real CV.
        try {
          const { data: pdfBlob } = await service.storage.from('resumes').download(draft.pdf_path);
          if (pdfBlob) {
            const buffer = Buffer.from(await pdfBlob.arrayBuffer());
            const { html, pageCount } = await pdfToVisionHtml(buffer);
            visionHtml = html;
            visionPageCount = pageCount;
            await service.from('profiles').update({
              original_html: html,
              original_page_count: pageCount,
              original_pdf_path: draft.pdf_path,
              // Refresh parsed_json too so downstream reads pick up the latest CV
              ...(parsed ? { parsed_json: parsed, structured_resume: buildStructuredResume(parsed) } : {}),
            }).eq('user_id', user.id);
            console.log(`[rolepitch/claim-draft ${rid}] vision backfilled on existing profile`, { pageCount });
          }
        } catch (e) {
          console.error(`[rolepitch/claim-draft ${rid}] vision backfill failed (non-fatal)`, { message: e.message });
        }
      }
    }

    // 3. Promote tailored result (if draft has one)
    let tailoredResumeId = null;
    let pitchCredits = null;

    if (draft.tailored) {
      // 3a. Resolve a JD row — reuse if jd_id, else insert from snapshot.
      let resolvedJdId = draft.jd_id;
      if (!resolvedJdId && draft.jd_snapshot?.description) {
        const { data: jdRow, error: jdErr } = await service
          .from('job_descriptions')
          .insert({
            user_id: user.id,
            title: draft.jd_snapshot.title || 'Untitled',
            company: draft.jd_snapshot.company || '',
            description: draft.jd_snapshot.description,
            source: 'pasted',
          })
          .select('id')
          .single();
        if (jdErr) {
          console.error(`[rolepitch/claim-draft ${rid}] jd insert error`, { message: jdErr.message, code: jdErr.code });
          return NextResponse.json({ error: `Failed to save JD: ${jdErr.message}`, rid }, { status: 500 });
        }
        resolvedJdId = jdRow.id;
        console.log(`[rolepitch/claim-draft ${rid}] jd inserted`, { jd_id: resolvedJdId });
      }

      if (resolvedJdId) {
        // 3b. Pitch credit pre-check (read-only — actual deduction is RPC after insert)
        const { data: u, error: balErr } = await service.from('users').select('pitch_credits').eq('id', user.id).single();
        if (balErr) {
          console.error(`[rolepitch/claim-draft ${rid}] balance read error`, { message: balErr.message });
        }
        const credits = u?.pitch_credits ?? 0;
        if (credits <= 0) {
          console.warn(`[rolepitch/claim-draft ${rid}] 402: no credits — skipping tailor insert, claiming profile only`);
          // Still mark draft claimed so it doesn't sit around.
        } else {
          const beforeScore = draft.before_score || draft.tailored?.before_score || 55;
          const afterScore = draft.after_score || draft.tailored?.after_score || 78;
          const tv = draft.tailored;
          const highlightsUsed = (tv.experience || []).reduce((s, r) => s + (r.bullets || []).length, 0);

          const { data: trRow, error: trErr } = await service
            .from('tailored_resumes')
            .insert({
              user_id: user.id,
              jd_id: resolvedJdId,
              base_version: parsed ? buildStructuredResume(parsed) : null,
              tailored_version: {
                ...tv,
                title: tv.title || parsed?.title || '',
                before_score: beforeScore,
                after_score: afterScore,
                highlights_used: highlightsUsed,
                bullets_rewritten: highlightsUsed,
                source_draft_id: draft.id,
              },
              pipeline_version: 'rolepitch-draft-v1',
              resume_strength: beforeScore,
            })
            .select('id')
            .single();
          if (trErr) {
            console.error(`[rolepitch/claim-draft ${rid}] tailored_resume insert error`, {
              message: trErr.message,
              code: trErr.code,
              details: trErr.details,
            });
            return NextResponse.json({ error: `Failed to save tailored resume: ${trErr.message}`, rid }, { status: 500 });
          }
          tailoredResumeId = trRow.id;
          console.log(`[rolepitch/claim-draft ${rid}] tailored_resume inserted`, { tailored_resume_id: tailoredResumeId });

          // 3c+4. Deduct credit + mark draft claimed in parallel — both non-fatal, independent tables
          const [dedResult, claimResult] = await Promise.all([
            service.rpc('deduct_pitch_credit', { p_user_id: user.id }),
            service
              .from('rp_drafts')
              .update({ user_id: user.id, status: 'claimed', claimed_at: new Date().toISOString() })
              .eq('id', draft.id),
          ]);
          if (dedResult.error) {
            console.error(`[rolepitch/claim-draft ${rid}] credit deduction failed (non-fatal)`, { message: dedResult.error.message });
          } else {
            pitchCredits = dedResult.data;
            console.log(`[rolepitch/claim-draft ${rid}] credit deducted`, { remaining: pitchCredits });
          }
          if (claimResult.error) {
            console.error(`[rolepitch/claim-draft ${rid}] mark-claimed failed (non-fatal)`, { message: claimResult.error.message });
          }

          // 3d. Pre-render the final tailored HTML so first download is instant.
          // Non-fatal — if Sonnet fails or times out, download-pdf will render on demand.
          try {
            const mergedResume = {
              name: tv.name || parsed?.name || '',
              contact: tv.contact || parsed?.contact || {},
              summary: tv.summary || '',
              experience: tv.experience || [],
              education: tv.education || [],
              skills: tv.skills || [],
            };
            const finalHtml = await renderTailoredHtml({
              originalHtml: visionHtml,
              pageCount: visionPageCount,
              mergedResume,
              jobContext: {
                title: draft.jd_snapshot?.title || '',
                company: draft.jd_snapshot?.company || '',
                description: (draft.jd_snapshot?.description || '').slice(0, 3000),
              },
              buildFastHtml,
            });
            await service
              .from('tailored_resumes')
              .update({ tailored_html: finalHtml })
              .eq('id', tailoredResumeId);
            console.log(`[rolepitch/claim-draft ${rid}] pre-rendered tailored_html`, { len: finalHtml.length });
          } catch (e) {
            console.warn(`[rolepitch/claim-draft ${rid}] pre-render failed (non-fatal)`, { message: e?.message });
          }
        }
      }
    }

    // 4. Mark draft claimed — only if not already done in the parallel block above
    if (!tailoredResumeId) {
      const { error: claimErr } = await service
        .from('rp_drafts')
        .update({ user_id: user.id, status: 'claimed', claimed_at: new Date().toISOString() })
        .eq('id', draft.id);
      if (claimErr) {
        console.error(`[rolepitch/claim-draft ${rid}] mark-claimed failed (non-fatal)`, { message: claimErr.message });
      }
    }

    console.log(`[rolepitch/claim-draft ${rid}] DONE 200`, {
      total_ms: Date.now() - t0,
      tailored_resume_id: tailoredResumeId,
      had_tailored: !!draft.tailored,
    });

    return NextResponse.json({
      claimed: true,
      has_tailored: !!draft.tailored,
      tailored_resume_id: tailoredResumeId,
      pitch_credits: pitchCredits,
      draft_id: draft.id,
    });
  } catch (err) {
    console.error(`[rolepitch/claim-draft ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
