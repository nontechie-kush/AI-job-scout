/**
 * POST /api/ai/resume-memory-check
 *
 * Body: { tailored_resume_id: string }
 *
 * Checks whether the user's gaps (from cached gap analysis) can be filled
 * from their stored knowledge graph (user_experience_memory) without
 * needing a conversation.
 *
 * Returns per-gap coverage + pre-drafted bullets for covered gaps.
 * Frontend uses this to:
 *   - Show "Pilot is checking what I already know" animation
 *   - If all gaps covered → jump straight to propose-direct stage
 *   - If partial → open chat with pre-filled context so Pilot only asks about uncovered gaps
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildMemoryCheckPrompt } from '@/lib/ai/prompts/memory-check';
import { rankRelevantNuggets } from '@/lib/ai/prompts/extract-memory';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Same token-splitting as resume-content/route.js
const STOPWORDS = new Set([
  'the','a','an','and','or','but','for','with','in','on','at','to','of','from',
  'is','are','was','were','be','been','being','has','have','had','do','does','did',
  'this','that','these','those','it','its','your','you','we','our','their',
  'need','needs','should','could','would','can','will','may','might',
  'more','most','some','any','all','no','not','such','about','which','who','what','when','where','how',
  'experience','experiences','skill','skills','role','job','work','working',
]);

function textToTags(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
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

    // Fetch tailored resume + cached gap analysis
    const { data: tailoredResume } = await supabase
      .from('tailored_resumes')
      .select('id, match_id, changes')
      .eq('id', tailored_resume_id)
      .eq('user_id', user.id)
      .single();

    if (!tailoredResume) {
      return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });
    }

    // Extract gaps from cached analysis
    const cachedAnalysis = tailoredResume.changes?._gap_analysis;
    const gaps = cachedAnalysis?.missing_signals || [];

    if (!gaps.length) {
      return NextResponse.json({
        gaps: [],
        coverage: [],
        coverage_ratio: 1,
        all_covered: true,
        total_nuggets_checked: 0,
      });
    }

    // Get job context
    let jobContext = null;
    if (tailoredResume.match_id) {
      const { data: match } = await supabase
        .from('job_matches')
        .select('jobs ( title, company, description )')
        .eq('id', tailoredResume.match_id)
        .maybeSingle();
      if (match?.jobs) jobContext = match.jobs;
    }

    // Fetch user's nuggets
    const { data: allNuggets } = await supabase
      .from('user_experience_memory')
      .select('id, nugget_type, company, role, fact, metric, tags, confidence, extracted_at')
      .eq('user_id', user.id)
      .order('extracted_at', { ascending: false })
      .limit(200);

    const totalNuggets = (allNuggets || []).length;

    // No memory yet — everything needs to be asked
    if (!totalNuggets) {
      return NextResponse.json({
        gaps,
        coverage: gaps.map((_, i) => ({
          gap_index: i,
          covered: false,
          evidence_nugget_ids: [],
          missing: 'No prior knowledge — need to ask the user.',
        })),
        coverage_ratio: 0,
        all_covered: false,
        total_nuggets_checked: 0,
      });
    }

    // Rank nuggets by relevance to the union of all gap tags
    const gapTags = [
      ...gaps.flatMap((g) => textToTags(g.gap)),
      ...textToTags(jobContext?.title),
    ];
    const relevantNuggets = rankRelevantNuggets(allNuggets, gapTags, 15);

    // If nothing is relevant, short-circuit — no need to call Claude
    if (!relevantNuggets.length) {
      return NextResponse.json({
        gaps,
        coverage: gaps.map((_, i) => ({
          gap_index: i,
          covered: false,
          evidence_nugget_ids: [],
          missing: 'None of the stored memory maps to this gap.',
        })),
        coverage_ratio: 0,
        all_covered: false,
        total_nuggets_checked: totalNuggets,
      });
    }

    // Ask Haiku to judge coverage gap-by-gap
    const { system, user: userPrompt } = buildMemoryCheckPrompt(gaps, relevantNuggets, jobContext);

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const parsed = JSON.parse(raw);
    const coverage = Array.isArray(parsed.coverage) ? parsed.coverage : [];

    // Enrich coverage with the actual nugget facts (so UI can show "Found: ...")
    const nuggetById = new Map(relevantNuggets.map((n) => [n.id, n]));
    const enrichedCoverage = coverage.map((c) => ({
      ...c,
      evidence: (c.evidence_nugget_ids || [])
        .map((id) => nuggetById.get(id))
        .filter(Boolean)
        .map((n) => ({
          id: n.id,
          fact: n.fact,
          company: n.company,
          role: n.role,
        })),
    }));

    const coveredCount = enrichedCoverage.filter((c) => c.covered).length;
    const coverageRatio = gaps.length > 0 ? coveredCount / gaps.length : 0;

    return NextResponse.json({
      gaps,
      coverage: enrichedCoverage,
      coverage_ratio: coverageRatio,
      all_covered: coveredCount === gaps.length && gaps.length > 0,
      total_nuggets_checked: totalNuggets,
      relevant_nuggets_count: relevantNuggets.length,
    });
  } catch (err) {
    console.error('[resume-memory-check]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
