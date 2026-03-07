/**
 * Culture synthesis — combines Glassdoor + AmbitionBox data into a
 * Pilot-voiced culture read using Claude Haiku.
 *
 * Exports: synthesizeCulture(companyName, glassdoor, ambitionbox)
 * Returns: { culture_summary, top_positives, top_warnings, interview_process, common_complaints }
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildCulturePrompt } from './prompts/culture-synthesis';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function synthesizeCulture(companyName, glassdoor, ambitionbox) {
  // If neither source has data, return empty — no Claude call needed
  if (!glassdoor && !ambitionbox) {
    return {
      culture_summary: null,
      top_positives: [],
      top_warnings: [],
      interview_process: null,
      common_complaints: null,
    };
  }

  const prompt = buildCulturePrompt(companyName, glassdoor, ambitionbox);

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');

  const result = JSON.parse(raw);

  return {
    culture_summary: result.culture_summary || null,
    top_positives: Array.isArray(result.top_positives) ? result.top_positives.slice(0, 2) : [],
    top_warnings: Array.isArray(result.top_warnings) ? result.top_warnings.slice(0, 1) : [],
    interview_process: result.interview_process || null,
    common_complaints: result.common_complaints || null,
  };
}
