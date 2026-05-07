/**
 * POST /api/rolepitch/save-resume
 *
 * Saves the parsed resume (from RolePitch pre-login flow) to the profiles table.
 * Called after OAuth sign-in when parsedResume is in localStorage session.
 *
 * Body: { parsed: <parsed resume JSON from /api/rolepitch/parse-resume> }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

function makeRid() {
  return `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/save-resume ${rid}] START`, { has_auth: !!request.headers.get('authorization') });

  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (!user) {
      console.warn(`[rolepitch/save-resume ${rid}] 401: no user`, { auth_err: userErr?.message || null });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { parsed, jd, tailored, jd_id: existingJdId, source: rawSource } = await request.json();

    // profiles.source CHECK constraint: pdf | website | text | linkedin_pdf | image
    // Default to 'text' (broadest, paste-style fallback) if caller didn't pass one.
    const ALLOWED_SOURCES = new Set(['pdf', 'website', 'text', 'linkedin_pdf', 'image']);
    const profileSource = ALLOWED_SOURCES.has(rawSource) ? rawSource : 'text';

    console.log(`[rolepitch/save-resume ${rid}] payload`, {
      user_id: user.id,
      jd_id: existingJdId || null,
      has_tailored: !!tailored,
      has_jd_desc: !!jd?.description,
      has_parsed: !!parsed,
      experience_count: parsed?.experience?.length || 0,
      raw_source: rawSource || null,
      profile_source: profileSource,
    });
    if (!parsed) {
      console.warn(`[rolepitch/save-resume ${rid}] 400: parsed required`);
      return NextResponse.json({ error: 'parsed required' }, { status: 400 });
    }

    // ── Credit pre-check (read-only) — actual deduction happens only after the tailored row inserts ──
    // Prevents orphan deductions when the insert fails or the request is replayed without a JD.
    const service = tailored ? createServiceClient() : null;
    if (tailored) {
      const { data: u, error: balErr } = await service.from('users').select('pitch_credits').eq('id', user.id).single();
      if (balErr) {
        console.error(`[rolepitch/save-resume ${rid}] balance read error`, { message: balErr.message, code: balErr.code });
        return NextResponse.json({ error: 'Credit check failed' }, { status: 500 });
      }
      console.log(`[rolepitch/save-resume ${rid}] credit check`, { pitch_credits: u?.pitch_credits });
      if ((u?.pitch_credits ?? 0) <= 0) {
        console.warn(`[rolepitch/save-resume ${rid}] 402: no credits`);
        return NextResponse.json({ error: 'no_credits', message: 'You have no pitches remaining. Please upgrade to continue.' }, { status: 402 });
      }
    }

    // Build structured_resume from the parsed result
    const structured_resume = {
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

    // Only save/update profile if user doesn't already have one (new user first-time flow)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      const { error: saveError } = await supabase.from('profiles').insert({
        user_id: user.id,
        raw_text: '',
        source: profileSource,
        parsed_json: parsed,
        structured_resume,
        parsed_at: new Date().toISOString(),
        claude_model: 'claude-opus-4-6',
      });
      if (saveError) {
        console.error(`[rolepitch/save-resume ${rid}] profile insert error`, {
          message: saveError.message,
          code: saveError.code,
          details: saveError.details,
          hint: saveError.hint,
        });
        return NextResponse.json({ error: saveError.message }, { status: 500 });
      }
      console.log(`[rolepitch/save-resume ${rid}] profile inserted`);
    } else {
      console.log(`[rolepitch/save-resume ${rid}] profile exists, skipped insert`);
    }

    // Save JD + tailored result if provided (final step sign-in)
    if (tailored && (existingJdId || jd?.description)) {
      // Use existing jd_id if init-match already created the row (authenticated flow)
      let resolvedJdId = existingJdId || null;
      if (!resolvedJdId && jd?.description) {
        const { data: jdRow, error: jdInsErr } = await supabase
          .from('job_descriptions')
          .insert({ user_id: user.id, title: jd.title || 'Untitled', company: jd.company || '', description: jd.description, source: 'rolepitch' })
          .select('id').single();
        if (jdInsErr) {
          console.error(`[rolepitch/save-resume ${rid}] jd insert error`, { message: jdInsErr.message, code: jdInsErr.code });
        }
        resolvedJdId = jdRow?.id || null;
        console.log(`[rolepitch/save-resume ${rid}] jd inserted`, { jd_id: resolvedJdId });
      }

      if (resolvedJdId) {
        const jdRow = { id: resolvedJdId };
        const beforeScore = tailored.before_score || 55;
        const afterScore = tailored.after_score || 78;
        const tailoredVersion = tailored.tailored || {};
        const highlightsUsed = (tailoredVersion.experience || []).reduce((s, r) => s + (r.bullets || []).length, 0);

        console.log(`[rolepitch/save-resume ${rid}] inserting tailored_resume`, { jd_id: resolvedJdId, highlights: highlightsUsed });
        const { data: trRow, error: trErr } = await supabase.from('tailored_resumes').insert({
          user_id: user.id,
          jd_id: jdRow.id,
          base_version: structured_resume,
          tailored_version: {
            ...tailoredVersion,
            title: tailoredVersion.title || parsed.title || '',
            before_score: beforeScore,
            after_score: afterScore,
            highlights_used: highlightsUsed,
            bullets_rewritten: highlightsUsed,
          },
          pipeline_version: 'rolepitch-v1',
          resume_strength: beforeScore,
        }).select('id').single();

        if (trErr || !trRow?.id) {
          console.error(`[rolepitch/save-resume ${rid}] tailored_resumes insert error`, {
            message: trErr?.message,
            code: trErr?.code,
            details: trErr?.details,
            hint: trErr?.hint,
            no_id: !trRow?.id,
          });
          return NextResponse.json({ error: trErr?.message || 'Failed to save tailored resume' }, { status: 500 });
        }
        console.log(`[rolepitch/save-resume ${rid}] tailored_resume inserted`, { tailored_resume_id: trRow.id });

        // Insert succeeded — deduct one pitch credit atomically.
        const { data: remaining, error: creditErr } = await service.rpc('deduct_pitch_credit', { p_user_id: user.id });
        if (creditErr) {
          console.error(`[rolepitch/save-resume ${rid}] credit deduction error (non-fatal)`, { message: creditErr.message, code: creditErr.code });
        } else {
          console.log(`[rolepitch/save-resume ${rid}] credit deducted`, { remaining });
        }
        console.log(`[rolepitch/save-resume ${rid}] DONE 200 (tailored)`, { total_ms: Date.now() - t0, tailored_resume_id: trRow.id });
        return NextResponse.json({ ok: true, tailored_resume_id: trRow.id, pitch_credits: remaining });
      }
    }

    console.log(`[rolepitch/save-resume ${rid}] DONE 200`, { total_ms: Date.now() - t0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[rolepitch/save-resume ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
