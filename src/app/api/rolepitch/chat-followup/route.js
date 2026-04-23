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

// One-word / one-phrase answers that need probing — mapped to context-aware follow-ups
const THIN_ANSWERS = /^(yes|no|yep|nope|maybe|partially|sure|kind of|sort of|not really|idk|i don't know|na|n\/a|i dont have any|i don't have any|none|never|nah)\.?$/i;

export async function POST(request) {
  try {
    const { question, answer, tip } = await request.json();
    if (!question || !answer) return NextResponse.json({ action: 'advance' });

    const trimmed = answer.trim();

    // Short yes/no — use Haiku to generate a context-aware follow-up instead of canned response
    if (THIN_ANSWERS.test(trimmed) || trimmed.length < 20) {
      const isNegative = /^(no|nope|not really|none|never|nah|i don.t have|i dont have)/.test(trimmed.toLowerCase());

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        temperature: 0.3,
        system: `You are Pilot — a sharp, direct career coach (think Cooper from Interstellar).
You asked a candidate a gap question. They gave a thin answer.
Write ONE follow-up question that digs deeper.

Rules:
- If their answer is negative ("no", "not really", "I don't have any"): ask about adjacent or indirect experience — don't just accept the "no"
- If their answer is positive but vague ("yes", "kind of"): ask for specifics — situation, scale, outcome
- Be warm but direct. No fluff. 1-2 sentences max.
- Never say "great" or "interesting" — just dig.
- Output ONLY the follow-up question, no labels or JSON.`,
        messages: [{
          role: 'user',
          content: `Gap context: ${tip || question}\nMy question: ${question}\nCandidate's answer: "${trimmed}"`,
        }],
      });

      const followup = msg.content[0].text.trim();
      return NextResponse.json({ action: 'followup', followup });
    }

    // Longer answer — ask Haiku to judge quality and optionally probe
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      temperature: 0.2,
      system: `You are evaluating a job candidate's answer to a resume gap question.
A good answer has: specific situation or context, what they actually did, and ideally a number or outcome.

If the answer is concrete enough to write a strong resume bullet → output exactly: {"action":"advance"}
If it's vague, missing context, or missing outcomes → output: {"action":"followup","followup":"<targeted follow-up in Pilot's voice — direct, curious, 1-2 sentences, asks for the specific missing piece>"}

Output ONLY valid JSON. The followup should reference the specific gap topic, not be generic.`,
      messages: [{
        role: 'user',
        content: `Gap context: ${tip || ''}\nQuestion asked: ${question}\nAnswer: ${trimmed}`,
      }],
    });

    const raw = msg.content[0].text.trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ action: 'advance' });
  }
}
