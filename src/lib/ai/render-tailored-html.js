/**
 * Render the final tailored resume HTML.
 *
 * Two modes:
 *   - Vision-merged (preferred when originalHtml is stored): Claude Sonnet
 *     overlays the tailored content onto the user's original layout.
 *   - Fast template (no original captured): callers pass buildFastHtml().
 *
 * Returns a complete HTML document. Used by download-pdf (sync), and
 * proactively by claim-draft after a pitch is created so subsequent
 * downloads are instant.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildResumeHtmlTailorPrompt } from '@/lib/ai/prompts/resume-html-tailor';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripFences(html) {
  return html
    .replace(/^\s*```(?:html)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim();
}

export async function renderTailoredHtml({
  originalHtml,
  pageCount,
  mergedResume,
  jobContext,
  buildFastHtml,
}) {
  if (!originalHtml) {
    return buildFastHtml(mergedResume, jobContext?.title || '');
  }

  const { system, user: userPrompt } = buildResumeHtmlTailorPrompt({
    originalHtml,
    pageCount: pageCount || 1,
    tailoredVersion: mergedResume,
    jobContext: jobContext || {},
  });

  const tailorMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const merged = stripFences(tailorMsg.content[0].text);
  if (!merged.toLowerCase().includes('<!doctype')) {
    return buildFastHtml(mergedResume, jobContext?.title || '');
  }
  return merged;
}
