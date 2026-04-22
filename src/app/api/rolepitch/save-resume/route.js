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

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { parsed, jd, tailored, jd_id: existingJdId } = await request.json();
    console.log('[save-resume] user:', user.id, '| jd_id:', existingJdId, '| has_tailored:', !!tailored, '| has_jd_desc:', !!jd?.description, '| has_parsed:', !!parsed);
    if (!parsed) return NextResponse.json({ error: 'parsed required' }, { status: 400 });

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
      education: (parsed.education_detail || parsed.education || []).map(ed => ({
        degree: ed.degree,
        institution: ed.institution,
        start_date: ed.start_date || null,
        end_date: ed.end_date || null,
      })),
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
        source: 'rolepitch',
        parsed_json: parsed,
        structured_resume,
        parsed_at: new Date().toISOString(),
        claude_model: 'claude-opus-4-6',
      });
      if (saveError) {
        console.error('[rolepitch/save-resume] profile insert error:', saveError.message);
        return NextResponse.json({ error: saveError.message }, { status: 500 });
      }
    }

    // Save JD + tailored result if provided (final step sign-in)
    if (tailored && (existingJdId || jd?.description)) {
      // Use existing jd_id if init-match already created the row (authenticated flow)
      let resolvedJdId = existingJdId || null;
      if (!resolvedJdId && jd?.description) {
        const { data: jdRow } = await supabase
          .from('job_descriptions')
          .insert({ user_id: user.id, title: jd.title || 'Untitled', company: jd.company || '', description: jd.description, source: 'rolepitch' })
          .select('id').single();
        resolvedJdId = jdRow?.id || null;
      }

      if (resolvedJdId) {
        const jdRow = { id: resolvedJdId };
        const beforeScore = tailored.before_score || 55;
        const afterScore = tailored.after_score || 78;
        const tailoredVersion = tailored.tailored || {};
        const highlightsUsed = (tailoredVersion.experience || []).reduce((s, r) => s + (r.bullets || []).length, 0);

        console.log('[save-resume] inserting tailored_resume for jd_id:', resolvedJdId);
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

        if (trErr) console.error('[save-resume] tailored_resumes insert error:', trErr.message);
        console.log('[save-resume] inserted tailored_resume:', trRow?.id);
        return NextResponse.json({ ok: true, tailored_resume_id: trRow?.id || null });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[rolepitch/save-resume]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
