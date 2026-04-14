/**
 * POST /api/ai/resume-gap-analysis
 *
 * Body: { match_id: string }
 *
 * Analyzes a user's structured resume against a job description.
 * Returns resume strength score, strong/weak bullets, missing signals, and a nudge message.
 *
 * CACHING: Results are stored in tailored_resumes (status='draft', changes holds the analysis).
 * Subsequent calls for the same match_id return the cached result without calling Claude.
 *
 * Graceful degradation for Naukri short JDs (confidence: 'low').
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildResumeGapPrompt } from '@/lib/ai/prompts/resume-gap-analysis';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id } = await request.json();
    if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

    // Fetch match + job, profile, and check for existing tailored resume in parallel
    const [{ data: match }, { data: profileRow }, { data: existingTailor }] = await Promise.all([
      supabase
        .from('job_matches')
        .select(`
          id, match_reasons, gap_analysis,
          jobs (
            id, title, company, company_domain, description,
            location, remote_type, source
          )
        `)
        .eq('id', match_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('id, raw_text, structured_resume')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle(),
      supabase
        .from('tailored_resumes')
        .select('id, resume_strength, status, changes')
        .eq('user_id', user.id)
        .eq('match_id', match_id)
        .maybeSingle(),
    ]);

    if (!match?.jobs) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (!profileRow) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 });
    }

    const job = match.jobs;

    // ── Cache hit: return stored analysis ─────────────────────────
    if (existingTailor) {
      // If finalized, just return strength + tailored flag
      if (existingTailor.status === 'finalized') {
        return NextResponse.json({
          resume_strength: existingTailor.resume_strength,
          already_tailored: true,
          tailored_resume_id: existingTailor.id,
        });
      }

      // If draft with cached analysis, return it without calling Claude
      const cached = existingTailor.changes?._gap_analysis;
      if (cached) {
        return NextResponse.json({
          ...cached,
          already_tailored: false,
          tailored_resume_id: existingTailor.id,
        });
      }
    }

    // ── No cache — run analysis ───────────────────────────────────

    // Ensure structured_resume exists — generate lazily if needed
    let structuredResume = profileRow.structured_resume;
    if (!structuredResume) {
      const { buildResumeStructurePrompt } = await import('@/lib/ai/prompts/resume-structure');
      if (!profileRow.raw_text) {
        return NextResponse.json(
          { error: 'No resume text available. Re-upload your resume.' },
          { status: 400 },
        );
      }

      const { system: structSys, user: structUser } = buildResumeStructurePrompt(profileRow.raw_text);
      const structMsg = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        temperature: 0.3,
        system: structSys,
        messages: [{ role: 'user', content: structUser }],
      });
      const structRaw = structMsg.content[0].text
        .trim()
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '');
      structuredResume = JSON.parse(structRaw);

      // Save for future use (non-blocking)
      supabase
        .from('profiles')
        .update({ structured_resume: structuredResume })
        .eq('id', profileRow.id)
        .then(() => {});
    }

    // Determine confidence based on JD length
    const descLength = (job.description || '').replace(/<[^>]+>/g, ' ').trim().length;
    let confidence = 'high';
    if (descLength < 200) confidence = 'low';
    else if (descLength < 600) confidence = 'medium';

    // Run gap analysis with Claude Haiku
    const { system, user: userPrompt } = buildResumeGapPrompt(
      structuredResume,
      job,
      { match_reasons: match.match_reasons || [], gap_analysis: match.gap_analysis || [] },
      confidence,
    );

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const analysis = JSON.parse(raw);

    const result = {
      resume_strength: analysis.resume_strength || 50,
      confidence: analysis.confidence || confidence,
      strong_bullets: analysis.strong_bullets || [],
      weak_bullets: analysis.weak_bullets || [],
      missing_signals: analysis.missing_signals || [],
      reorder_suggestions: analysis.reorder_suggestions || [],
      nudge_message: analysis.nudge_message || '',
    };

    // ── Cache the result ──────────────────────────────────────────
    if (existingTailor) {
      // Update existing draft with cached analysis
      await supabase
        .from('tailored_resumes')
        .update({
          resume_strength: result.resume_strength,
          changes: { _gap_analysis: result },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTailor.id);

      return NextResponse.json({
        ...result,
        already_tailored: false,
        tailored_resume_id: existingTailor.id,
      });
    } else {
      // Create a new draft record to cache the analysis
      const { data: newTailor } = await supabase
        .from('tailored_resumes')
        .insert({
          user_id: user.id,
          match_id,
          base_version: structuredResume,
          tailored_version: structuredResume,
          resume_strength: result.resume_strength,
          changes: { _gap_analysis: result },
          status: 'draft',
        })
        .select('id')
        .single();

      return NextResponse.json({
        ...result,
        already_tailored: false,
        tailored_resume_id: newTailor?.id || null,
      });
    }
  } catch (err) {
    console.error('[resume-gap-analysis]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
