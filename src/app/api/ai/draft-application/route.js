/**
 * POST /api/ai/draft-application
 *
 * Body: { match_id: string }
 *
 * Generates a full application kit for a job match:
 *   - cover_letter       (150 words, or shorter cover note for Naukri/IIMJobs native)
 *   - bio                (2-sentence professional summary)
 *   - screening_qa       (array of {question, answer})
 *   - has_real_questions (boolean — true if questions came from ATS API or DB)
 *   - question_source    ('ats_api' | 'db' | 'generated')
 *   - apply_context      ('standard' | 'naukri_native' | 'iimjobs_native')
 *
 * Question sourcing priority:
 *   1. Naukri/IIMJobs enrichment — fetch listing page, detect company ATS URL
 *      then run ATS public API on that URL (Greenhouse / Lever / Ashby)
 *   2. Direct ATS public API on apply_url
 *   3. company_application_flows DB table — manually verified or extension-learned
 *   4. Claude generates role-specific questions from the job description
 *
 * Returns: { cover_letter, bio, screening_qa, has_real_questions, question_source, apply_context }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildApplicationPrompt } from '@/lib/ai/prompts/draft-application';
import { fetchATSQuestions } from '@/lib/ats/questions';
import { enrichApplyUrl, isIndianJobBoard } from '@/lib/ats/enrich';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id } = await request.json();
    if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

    // Fetch match + job in parallel with profile
    const [{ data: match }, { data: profileRow }] = await Promise.all([
      supabase
        .from('job_matches')
        .select(`
          id,
          jobs (
            id, title, company, company_domain, apply_type, apply_url,
            description, location, remote_type, salary_min, salary_max, salary_currency
          )
        `)
        .eq('id', match_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('parsed_json')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle(),
    ]);

    if (!match?.jobs) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const job = match.jobs;

    // ── Naukri / IIMJobs enrichment ────────────────────────────────────────
    // If the apply_url is a Naukri or IIMJobs listing page, try to detect
    // whether the company uses an external ATS (Greenhouse, Lever, etc.).
    // This runs at apply-time — no extra scraping during job ingestion.

    let effectiveApplyUrl = job.apply_url;
    let applyContext = 'standard'; // 'standard' | 'naukri_native' | 'iimjobs_native'

    if (isIndianJobBoard(job.apply_url)) {
      const isNaukri = job.apply_url?.includes('naukri.com');
      const enrichedUrl = await enrichApplyUrl(job.apply_url);

      if (enrichedUrl) {
        // Found a company ATS link — use it for question fetching
        effectiveApplyUrl = enrichedUrl;
        applyContext = 'standard'; // treat as standard ATS apply
      } else {
        // No external ATS found → native Indian job board apply
        // Native Naukri/IIMJobs apply = profile + short cover note
        effectiveApplyUrl = job.apply_url;
        applyContext = isNaukri ? 'naukri_native' : 'iimjobs_native';
      }
    }

    // ── Question sourcing: ATS API → DB → generate ─────────────────────────

    let knownQuestions = [];
    let hasRealQuestions = false;
    let questionSource = 'generated'; // 'ats_api' | 'db' | 'generated'

    // 1. Try ATS public API (works for Greenhouse/Lever/Ashby direct URLs,
    //    and for Naukri/IIMJobs jobs where enrichment found a company ATS URL)
    const atsQuestions = await fetchATSQuestions(effectiveApplyUrl);
    if (atsQuestions.length) {
      knownQuestions = atsQuestions;
      hasRealQuestions = true;
      questionSource = 'ats_api';
    }

    // 2. Fall back to company_application_flows (manually seeded or extension-learned)
    if (!hasRealQuestions) {
      try {
        const { data: flowRow } = await supabase
          .from('company_application_flows')
          .select('known_questions')
          .eq('company_domain', job.company_domain || '')
          .eq('apply_type', job.apply_type || 'external')
          .maybeSingle();

        if (flowRow?.known_questions?.length) {
          knownQuestions = flowRow.known_questions;
          hasRealQuestions = true;
          questionSource = 'db';
        }
      } catch {
        // Table may not exist yet — silently skip
      }
    }

    // 3. If neither source has questions, Claude generates role-specific ones
    //    For native Indian job board apply: generate a cover note (shorter, direct)
    //    instead of a formal cover letter — that's what Naukri's text box needs.

    const { system, user: userPrompt } = buildApplicationPrompt(
      job,
      profileRow?.parsed_json || {},
      knownQuestions,
      hasRealQuestions,
      applyContext,
    );

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const kit = JSON.parse(raw);

    return NextResponse.json({
      cover_letter: kit.cover_letter || '',
      bio: kit.bio || '',
      screening_qa: Array.isArray(kit.screening_qa) ? kit.screening_qa : [],
      has_real_questions: hasRealQuestions,
      question_source: questionSource,
      apply_context: applyContext,
    });
  } catch (err) {
    console.error('[draft-application]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
