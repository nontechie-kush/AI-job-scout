/**
 * POST /api/rolepitch/critique
 *
 * Stateless resume critique — no auth required.
 * Extracts lead data (name/email/phone) passively from parsed resume.
 * Stores critique in rp_critiques table with 7-day expiry.
 *
 * Body: { parsed_resume, target_context }
 * Returns: { critique_id, critique }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(text) {
  const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try { return JSON.parse(clean); } catch { return null; }
}

export async function POST(request) {
  try {
    const { parsed_resume, target_context } = await request.json();

    if (!parsed_resume) {
      return NextResponse.json({ error: 'parsed_resume required' }, { status: 400 });
    }

    const experiences = (parsed_resume.experience || []);
    const resumeText = experiences.map(role => {
      const bullets = (role.bullets || []).map(b => `  • ${typeof b === 'string' ? b : b.text}`).join('\n');
      return `${role.title} at ${role.company} (${role.start_date || '?'} – ${role.end_date || 'Present'})\n${bullets || '  (no bullets)'}`;
    }).join('\n\n');

    const targetLine = target_context
      ? `TARGET: ${target_context}`
      : 'TARGET: Not specified — critique for general professional roles';

    const prompt = `You are a ruthlessly honest resume coach. Critique this resume for the target below.

${targetLine}

RESUME:
Name: ${parsed_resume.name || ''}
Summary: ${parsed_resume.summary || '(none)'}
Skills: ${(parsed_resume.skills || []).join(', ') || '(none)'}

${resumeText}

Return ONLY valid JSON — no markdown, no explanation.

{
  "overall_score": <integer 0-100>,
  "score_label": <"Needs Work" | "Getting There" | "Strong" | "Excellent">,
  "headline_verdict": "<one punchy sentence: what this resume's biggest problem is right now>",
  "sections": {
    "summary": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<2-3 sentences>", "rewrite": "<improved version or null>" },
    "bullets": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<2-3 sentences>", "examples": [ { "original": "<worst bullet>", "rewrite": "<better version>" }, { "original": "<second worst>", "rewrite": "<better version>" } ] },
    "skills": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<1-2 sentences>" },
    "structure": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<1-2 sentences>" },
    "impact": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<2-3 sentences about quantification and metrics>" }
  },
  "top_fixes": [
    "<Most critical fix — be specific, name the section and what to do>",
    "<Second fix>",
    "<Third fix>",
    "<Fourth fix>",
    "<Fifth fix>"
  ],
  "what_works": ["<one genuine strength>", "<another strength>"],
  "gap_to_target": "<1-2 sentences on what's missing vs their stated target, or 'Resume is reasonably aligned with your target' if context not given>"
}

RULES:
- Be direct and specific. Name actual bullet text, not vague advice.
- overall_score: 40-60 for average, 60-75 for decent, 75+ for strong.
- score_label must match: <50 = Needs Work, 50-65 = Getting There, 65-80 = Strong, 80+ = Excellent.
- top_fixes: prioritized, most impactful first. Each under 20 words.
- bullet examples: pick the weakest bullets and show a 12-18 word rewrite with STAR structure.
- If summary is missing, say so and write a suggested one.`;

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const critique = tolerantParse(msg.content[0].text);
    if (!critique) {
      return NextResponse.json({ error: 'Failed to parse critique response' }, { status: 500 });
    }

    // Store in DB — passive lead capture from resume
    const supabase = createServiceClient();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: row, error: dbError } = await supabase
      .from('rp_critiques')
      .insert({
        name: parsed_resume.name || null,
        email: parsed_resume.contact?.email || null,
        phone: parsed_resume.contact?.phone || null,
        target_context: target_context || null,
        critique_json: critique,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[critique] DB insert error:', dbError.message);
      // Still return critique even if DB fails — don't block user
      return NextResponse.json({ critique, critique_id: null });
    }

    return NextResponse.json({ critique, critique_id: row.id });

  } catch (err) {
    console.error('[rolepitch/critique]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
