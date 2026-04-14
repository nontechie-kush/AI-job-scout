/**
 * POST /api/ai/extract-memory
 *
 * Body: { conversation_id: string }
 *
 * Reads a finalized resume conversation and extracts durable nuggets
 * into user_experience_memory. Idempotent — dedupes by fact text before
 * insert. Safe to call multiple times.
 *
 * Called automatically by /api/ai/resume-content when stage === 'finalized'.
 * Non-blocking — failures here should not break the main flow.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildExtractMemoryPrompt } from '@/lib/ai/prompts/extract-memory';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation_id } = await request.json();
    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });
    }

    // Fetch conversation + tailored resume for context
    const { data: conversation } = await supabase
      .from('resume_conversations')
      .select(`
        id, messages, tailored_resume_id,
        tailored_resumes ( match_id )
      `)
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = conversation.messages || [];
    if (messages.length < 2) {
      // Not enough content to extract from
      return NextResponse.json({ extracted: 0, skipped: 'too_short' });
    }

    // Get job context from the match (for attribution hints)
    let context = {};
    const matchId = conversation.tailored_resumes?.match_id;
    if (matchId) {
      const { data: match } = await supabase
        .from('job_matches')
        .select('jobs ( title, company )')
        .eq('id', matchId)
        .maybeSingle();
      if (match?.jobs) {
        context = { company: match.jobs.company, role: match.jobs.title };
      }
    }

    // Call Haiku to extract nuggets
    const { system, user: userPrompt } = buildExtractMemoryPrompt(messages, context);

    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = aiMessage.content[0].text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const parsed = JSON.parse(raw);
    const nuggets = Array.isArray(parsed.nuggets) ? parsed.nuggets : [];

    if (!nuggets.length) {
      return NextResponse.json({ extracted: 0, skipped: 'no_nuggets' });
    }

    // Dedupe against existing facts for this user (simple text match)
    const { data: existing } = await supabase
      .from('user_experience_memory')
      .select('fact')
      .eq('user_id', user.id);

    const existingFacts = new Set((existing || []).map((e) => e.fact.toLowerCase().trim()));

    const toInsert = nuggets
      .filter((n) => n.fact && !existingFacts.has(n.fact.toLowerCase().trim()))
      .filter((n) => (n.confidence ?? 0) >= 0.5)
      .map((n) => ({
        user_id: user.id,
        nugget_type: n.nugget_type,
        company: n.company || null,
        role: n.role || null,
        fact: n.fact,
        metric: n.metric || null,
        tags: Array.isArray(n.tags) ? n.tags : [],
        confidence: n.confidence ?? 0.8,
        source_conversation_id: conversation_id,
        source_match_id: matchId || null,
      }));

    if (!toInsert.length) {
      return NextResponse.json({ extracted: 0, skipped: 'all_duplicates' });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('user_experience_memory')
      .insert(toInsert)
      .select('id, nugget_type, company, role, fact, tags');

    if (insertErr) {
      console.error('[extract-memory] insert failed', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      extracted: toInsert.length,
      nuggets: inserted || [],
    });
  } catch (err) {
    console.error('[extract-memory]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
