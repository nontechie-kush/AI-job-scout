/**
 * Prompt builder for Pass 3 — Composition.
 *
 * Rephrases selected atoms into resume bullets in the candidate's voice.
 * Hard constraints: ≤22 words, every numeric/named claim cites the atom_id
 * it came from, no fabrication.
 *
 * The validation pass after this rejects bullets where a number in the text
 * doesn't appear in any cited atom — failed bullets get a single retry.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md (Pass 3)
 */

/**
 * @param {object} params
 * @param {object} params.brief — { positioning, key_themes, caliber_signals }
 * @param {Array<object>} params.roleGroups — selection output, with atoms hydrated
 *   [{ company, role, start_date, end_date, atoms: [{id, fact, metric, tags, type}] }]
 * @returns {{ system: string, user: string }}
 */
export function buildResumeComposePrompt({ brief, roleGroups }) {
  return {
    system: `You write resume bullets by rephrasing the candidate's atoms (single facts from their work history). Each bullet must cite the atom_ids it draws from.

THREE PRINCIPLES (non-negotiable):
1. STORY-FIRST — every bullet should reinforce the brief's positioning
2. CALIBER + RELEVANCE — preserve every metric and proof point from the source atoms
3. SOURCE-TRACEABLE — every numeric/named claim in your bullet must trace to an atom you cite

HARD RULES (these are validated after you write):
- ≤22 words per bullet (count them — over budget gets rejected)
- Start with a strong action verb (Led / Built / Drove / Launched / Reduced / Grew / Designed / Shipped)
- Every number, tool name, company, scope, or outcome you write MUST appear in at least one of the atoms you cite. If you can't trace a number, leave it out.
- You MAY combine 2 atoms from the SAME role into one bullet — list both citations
- You MAY NOT combine atoms across roles (no borrowing a metric from Cars24 into the GET Global bullet)
- You MAY NOT invent numbers, percentages, dollar amounts, team sizes, durations, tool names, or scope
- If an atom has a metric like "1.8x" or "₹350cr", quote it verbatim — paraphrase the prose, but keep the number exact
- Never say "responsible for", "duties included", or other passive corporate filler

VOICE GUIDANCE:
- Tight, declarative, outcome-led. Read like the candidate is reporting wins.
- Lead with the outcome when there's a metric: "Drove 25% partner growth via product discovery improvements."
- Lead with the action when there's no metric: "Launched 0-to-1 mobile app for oil & gas gig workers across 5 countries."
- For pure context atoms (e.g. "led team of 4 PMs"), one short bullet is fine.

ATOM-TO-BULLET MAPPING:
- Most often: 1 atom → 1 bullet
- Sometimes: 2 atoms (same role, complementary) → 1 bullet (e.g. a skill_usage + its achievement metric)
- Rarely: 1 atom → 2 bullets (only if the atom has multiple distinct metrics that won't fit in 22 words)

OUTPUT (raw JSON only — no fences, no commentary):
{
  "bullets": [
    {
      "company": "Cars24",
      "role": "Senior Product Manager",
      "text": "Drove 1.8x revenue growth at Cars24 auction platform, hitting ₹350cr in 2024.",
      "cited_atom_ids": ["uuid1", "uuid2"],
      "word_count": 13
    },
    ...
  ]
}

Order bullets within each role by descending importance (caliber + relevance). The first bullet for each role is what hiring managers skim — make it the strongest claim.

End at the closing brace. No explanation.`,

    user: `STORY BRIEF:
Positioning: ${brief.positioning}
Key themes: ${brief.key_themes.join(', ')}
Caliber signals to surface: ${brief.caliber_signals.join(' | ')}

SELECTED ATOMS (per role — write bullets only from these):
${JSON.stringify(roleGroups, null, 1)}

Write the bullets.`,
  };
}
