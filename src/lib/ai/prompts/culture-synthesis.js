/**
 * Culture synthesis prompt for Claude Haiku.
 * Given Glassdoor + AmbitionBox data, generates a Pilot-voiced culture read.
 *
 * Output: { culture_summary, top_positives[], top_warnings[], interview_process, common_complaints }
 */

export function buildCulturePrompt(companyName, glassdoor, ambitionbox) {
  const lines = [`COMPANY: ${companyName}`];

  if (glassdoor) {
    lines.push(`\nGlassdoor:`);
    if (glassdoor.rating) lines.push(`- Overall: ${glassdoor.rating}/5`);
    if (glassdoor.recommend_pct) lines.push(`- Recommend: ${glassdoor.recommend_pct}%`);
    if (glassdoor.ceo_approval) lines.push(`- CEO approval: ${glassdoor.ceo_approval}%`);
    if (glassdoor.wlb_score) lines.push(`- Work-life balance: ${glassdoor.wlb_score}/5`);
    if (glassdoor.culture_score) lines.push(`- Culture: ${glassdoor.culture_score}/5`);
    if (glassdoor.reviews_snippet) lines.push(`- Review excerpt: "${glassdoor.reviews_snippet.slice(0, 300)}"`);
  }

  if (ambitionbox) {
    lines.push(`\nAmbitionBox (India-specific):`);
    if (ambitionbox.rating) lines.push(`- Overall: ${ambitionbox.rating}/5`);
    if (ambitionbox.wlb_score) lines.push(`- Work-life balance: ${ambitionbox.wlb_score}/5`);
    if (ambitionbox.growth_score) lines.push(`- Growth: ${ambitionbox.growth_score}/5`);
    if (ambitionbox.recommend_pct) lines.push(`- Recommend: ${ambitionbox.recommend_pct}%`);
    if (ambitionbox.reviews_snippet) lines.push(`- Review excerpt: "${ambitionbox.reviews_snippet.slice(0, 300)}"`);
  }

  return `You are CareerPilot's Pilot AI. Write a culture read for a job seeker considering this company.

${lines.join('\n')}

Return ONLY valid JSON:
{
  "culture_summary": "1-2 sentences in direct, no-BS Pilot voice. Like Cooper from Interstellar — raw, real, owns the read. Example: 'Good engineering culture, managers step back and let you ship. Growth slows post-funding but equity is real.'",
  "top_positives": ["max 2 specific positives, not generic praise"],
  "top_warnings": ["0-1 specific red flag or watch-out, not generic"],
  "interview_process": "1-sentence description if data suggests something, else null",
  "common_complaints": "the most common gripe based on data, else null"
}

Voice rules: Direct. Specific. Never corporate-speak. "Good WLB" → "You'll actually leave before 7pm." "Growth opportunity" → "Promotions are real but slow." Raw JSON only.`;
}
