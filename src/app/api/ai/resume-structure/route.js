/**
 * POST /api/ai/resume-structure
 *
 * Converts a user's raw resume text into a structured, editable JSON document.
 * Called lazily when structured_resume is null on first access,
 * or explicitly from the Resume Tailor UI.
 *
 * Returns: { structured_resume: {...} }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildResumeStructurePrompt } from '@/lib/ai/prompts/resume-structure';
import { atomizeResume } from '@/lib/ai/atomize-resume';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch the user's latest profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, raw_text, structured_resume')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'No profile found. Upload a resume first.' }, { status: 404 });
    }

    // If structured_resume already exists, return it
    if (profile.structured_resume) {
      return NextResponse.json({ structured_resume: profile.structured_resume });
    }

    // Need raw_text to structure
    if (!profile.raw_text) {
      return NextResponse.json(
        { error: 'No resume text available. Re-upload your resume.' },
        { status: 400 },
      );
    }

    // Generate structured resume using Claude Opus
    const { system, user: userPrompt } = buildResumeStructurePrompt(profile.raw_text);

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const structuredResume = JSON.parse(raw);

    // Save to profiles
    await supabase
      .from('profiles')
      .update({ structured_resume: structuredResume })
      .eq('id', profile.id);

    // Fire-and-forget atomization for Resume Tailor v2 knowledge base.
    // Don't block the response — UI doesn't need atoms to render the structured resume.
    atomizeResume({
      supabase,
      userId: user.id,
      profile: { ...profile, structured_resume: structuredResume },
    })
      .then((r) => console.log('[resume-structure] atomization result:', r))
      .catch((e) => console.error('[resume-structure] atomization failed:', e.message));

    return NextResponse.json({ structured_resume: structuredResume });
  } catch (err) {
    console.error('[resume-structure]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
