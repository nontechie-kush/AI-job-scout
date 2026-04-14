/**
 * POST /api/ai/resume-tailor-init
 *
 * Creates a new tailored_resumes record for a specific job match.
 *
 * Body: { match_id: string, structured_resume: object, resume_strength?: number }
 * Returns: { id: string }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, structured_resume, resume_strength } = await request.json();
    if (!structured_resume) {
      return NextResponse.json({ error: 'structured_resume required' }, { status: 400 });
    }

    // Check if a tailored resume already exists for this match
    if (match_id) {
      const { data: existing } = await supabase
        .from('tailored_resumes')
        .select('id')
        .eq('user_id', user.id)
        .eq('match_id', match_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ id: existing.id });
      }
    }

    const { data, error } = await supabase
      .from('tailored_resumes')
      .insert({
        user_id: user.id,
        match_id: match_id || null,
        base_version: structured_resume,
        tailored_version: structured_resume,
        resume_strength: resume_strength || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[resume-tailor-init]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
