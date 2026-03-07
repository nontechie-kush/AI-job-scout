/**
 * Core job matching logic.
 * Uses Claude Haiku for speed/cost — matching is pattern recognition, not deep reasoning.
 *
 * Exports:
 *   makeProfileHash(parsedJson) → string
 *   buildCandidateSummary(profile, user) → CandidateSummary
 *   scoreBatch(candidate, jobs) → ScoreResult[]
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { buildMatchPrompt } from './prompts/match-job';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Hash of profile JSON — used to detect if profile changed since last scoring.
 * If profileHash matches existing job_match row, we skip re-scoring.
 */
export function makeProfileHash(parsedJson) {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(parsedJson || {}))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Build a compact candidate summary from profile + user prefs.
 * This is what gets sent to Claude for every batch.
 */
export function buildCandidateSummary(profile, user) {
  const p = profile?.parsed_json || {};
  return {
    // Explicit intent — what the user said they want (drives Step 1 gate)
    target_roles: (user.target_roles || []).slice(0, 3).join(', ') || '',
    // Background — used only to score fit within matching roles (Step 2)
    title:         p.title || 'Not specified',
    seniority:     p.seniority || 'mid',
    years_exp:     p.years_exp || 0,
    skills:        (p.skills || []).slice(0, 10).join(', ') || 'Not specified',
    strongest_card: p.strongest_card || 'Not specified',
    // Preferences
    location_pref: (user.locations || []).slice(0, 3).join(' / ') || 'Open',
    ic_or_lead:    user.ic_or_lead || 'either',
    stage_pref:    (user.company_stage || []).join(', ') || 'any',
    // NOTE: CV keywords intentionally excluded — they cause false function matches
    //       (e.g. "engagement" in CV → matches "Engagement Manager" consulting roles)
  };
}

/**
 * Score a batch of jobs (max 10) against a candidate profile.
 * Returns an array of { score, match_reasons, gap_analysis } in the same order as jobs.
 */
export async function scoreBatch(candidate, jobs) {
  if (!jobs.length) return [];

  const prompt = buildMatchPrompt(candidate, jobs);

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');

  const scores = JSON.parse(raw);

  if (!Array.isArray(scores)) {
    throw new Error(`Expected JSON array from model, got: ${typeof scores}`);
  }

  // Pad or trim to match input length (defensive)
  while (scores.length < jobs.length) scores.push({ score: 0, match_reasons: [], gap_analysis: [] });
  return scores.slice(0, jobs.length);
}
