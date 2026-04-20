/**
 * POST /api/rolepitch/chat-followup
 *
 * Judges a user's answer to a gap question and decides:
 *   - "advance" → answer is rich enough, move to next question
 *   - "followup" → answer is thin, return a targeted follow-up probe
 *
 * Body: { question: string, answer: string, tip: string }
 * Returns: { action: 'advance' | 'followup', followup?: string }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { question, answer, tip } = await request.json();
    if (!question || !answer) {
      return NextResponse.json({ action: 'advance' });
    }

    // Short/vague answers: yes, no, yep, nope, maybe, partially — always follow up
    const trivial = /^(yes|no|yep|nope|maybe|partially|sure|kind of|sort of|not really|idk|i don't know|na|n\/a|skip)\.?$/i;
    if (trivial.test(answer.trim())) {
      const probes = {
        'yes': `Tell me more — what specifically did you work on? Any numbers or outcomes?`,
        'no': `Got it. Have you had any adjacent experience — even indirectly or in a smaller scope?`,
        'maybe': `What part applies to you? Even partial experience is worth capturing.`,
        'partially': `What part do you have experience with? Walk me through it briefly.`,
      };
      const key = answer.trim().toLowerCase().replace(/[^a-z ]/g, '');
      const followup = probes[key] || `Can you tell me more? Even a sentence or two helps us write a stronger bullet.`;
      return NextResponse.json({ action: 'followup', followup });
    }

    // For longer answers, ask Haiku to judge quality
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      temperature: 0.2,
      system: `You are evaluating a job candidate's answer to a resume gap question.
Decide if the answer contains enough concrete detail to write a resume bullet (specific situation, action, or metric).
If yes → output exactly: {"action":"advance"}
If no → output exactly: {"action":"followup","followup":"<one short targeted follow-up question, max 20 words>"}
Output ONLY valid JSON, nothing else.`,
      messages: [{
        role: 'user',
        content: `Question: ${question}\nContext tip: ${tip || ''}\nAnswer: ${answer}`,
      }],
    });

    const raw = msg.content[0].text.trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch {
    // On any error, just advance — don't block the user
    return NextResponse.json({ action: 'advance' });
  }
}
