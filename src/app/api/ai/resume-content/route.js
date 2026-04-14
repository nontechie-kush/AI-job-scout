/**
 * POST /api/ai/resume-content
 *
 * Body: { tailored_resume_id: string, message: string, conversation_id?: string }
 *
 * Conversational Q&A with the Resume Content Creator agent.
 * Uses STAR framework to collect info, then proposes bullet point changes.
 *
 * Returns: { response, proposed_changes[], conversation_id, stage }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildContentCreatorPrompt } from '@/lib/ai/prompts/resume-content-creator';
import { rankRelevantNuggets, formatNuggetsForPrompt } from '@/lib/ai/prompts/extract-memory';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Extract simple lowercase tokens from text for tag matching.
// Stopwords filtered out; used to infer retrieval tags from gap text.
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

    const { tailored_resume_id, message, conversation_id } = await request.json();
    if (!tailored_resume_id || !message) {
      return NextResponse.json({ error: 'tailored_resume_id and message required' }, { status: 400 });
    }

    // Fetch tailored resume, conversation history, user prefs in parallel
    const [{ data: tailoredResume }, { data: conversation }, { data: userRow }] = await Promise.all([
      supabase
        .from('tailored_resumes')
        .select('id, tailored_version, changes, match_id, resume_strength')
        .eq('id', tailored_resume_id)
        .eq('user_id', user.id)
        .single(),
      conversation_id
        ? supabase
            .from('resume_conversations')
            .select('id, messages')
            .eq('id', conversation_id)
            .eq('user_id', user.id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from('users')
        .select('pilot_mode')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (!tailoredResume) {
      return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });
    }

    // Get conversation history
    const messages = conversation?.messages || [];

    // Add user's new message
    messages.push({ role: 'user', text: message, timestamp: new Date().toISOString() });

    // Fetch gap analysis data from the tailored resume's changes
    // Extract gaps from the stored analysis (if match_id exists)
    let gaps = [];
    let jobContext = null;

    if (tailoredResume.match_id) {
      const { data: match } = await supabase
        .from('job_matches')
        .select(`
          gap_analysis,
          jobs ( title, company, description )
        `)
        .eq('id', tailoredResume.match_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (match?.jobs) {
        jobContext = match.jobs;
        // Convert gap_analysis strings to gap objects for the prompt
        gaps = (match.gap_analysis || []).map((g, i) => ({
          gap: g,
          suggestion: 'Address this gap with a relevant bullet point',
          section: 'experience',
          target_entry_id: null,
        }));
      }
    }

    // Fetch user's experience memory and rank nuggets relevant to these gaps
    const gapTags = [
      ...gaps.flatMap((g) => textToTags(g.gap)),
      ...textToTags(jobContext?.title),
    ];

    let memoryBlock = '';
    if (gapTags.length) {
      const { data: allNuggets } = await supabase
        .from('user_experience_memory')
        .select('id, nugget_type, company, role, fact, metric, tags, confidence, extracted_at')
        .eq('user_id', user.id)
        .order('extracted_at', { ascending: false })
        .limit(200);

      const relevant = rankRelevantNuggets(allNuggets || [], gapTags, 8);
      memoryBlock = formatNuggetsForPrompt(relevant);

      // Track usage (non-blocking)
      if (relevant.length) {
        const ids = relevant.map((n) => n.id);
        supabase
          .from('user_experience_memory')
          .update({ last_used_at: new Date().toISOString() })
          .in('id', ids)
          .then(() => {});
      }
    }

    // Build and send prompt
    const { system, user: userPrompt } = buildContentCreatorPrompt(
      tailoredResume.tailored_version,
      gaps,
      messages,
      userRow?.pilot_mode || 'steady',
      jobContext,
      memoryBlock,
    );

    const aiMessage = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = aiMessage.content[0].text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    const result = JSON.parse(raw);

    // Add Pilot's response to conversation
    messages.push({
      role: 'pilot',
      text: result.response,
      proposed_changes: result.proposed_changes || [],
      timestamp: new Date().toISOString(),
    });

    // Save or update conversation
    let convId = conversation_id;
    if (convId) {
      await supabase
        .from('resume_conversations')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', convId);
    } else {
      const { data: newConv } = await supabase
        .from('resume_conversations')
        .insert({
          user_id: user.id,
          tailored_resume_id,
          messages,
        })
        .select('id')
        .single();
      convId = newConv?.id;
    }

    // When conversation finalizes, extract durable nuggets into user memory.
    // Fire-and-forget — failure here shouldn't break the user's flow.
    if (result.stage === 'finalized' && convId) {
      const origin = new URL(request.url).origin;
      fetch(`${origin}/api/ai/extract-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ conversation_id: convId }),
      }).catch((e) => console.error('[resume-content] memory extraction trigger failed', e));
    }

    return NextResponse.json({
      response: result.response || '',
      proposed_changes: result.proposed_changes || [],
      conversation_id: convId,
      stage: result.stage || 'collecting',
    });
  } catch (err) {
    console.error('[resume-content]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
