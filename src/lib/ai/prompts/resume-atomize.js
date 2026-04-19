/**
 * Prompt builder for the Resume Atomizer.
 *
 * Atomization breaks each resume bullet into 1-3 source-attributed atoms.
 * An atom is a single self-contained fact (an achievement, metric, skill use,
 * or context statement) that can be independently selected and recomposed
 * into a tailored resume.
 *
 * Atoms are the foundation of Resume Tailor v2 — instead of patching a frozen
 * resume document, we select atoms per-job and compose fresh bullets.
 *
 * Runs ONCE per resume upload. Output is inserted into user_experience_memory
 * with source_type='original_resume' and source_bullet_id linking back to the
 * structured_resume bullet ID.
 */

/**
 * @param {object} structuredResume — full structured resume JSON
 * @returns {{ system: string, user: string }}
 */
export function buildResumeAtomizePrompt(structuredResume) {
  // Build a compact view of the resume that the model can atomize.
  // Only experience and projects have atoms (other sections aren't claim-bearing).
  const sections = [];

  for (const exp of structuredResume.experience || []) {
    sections.push({
      kind: 'experience',
      entry_id: exp.id,
      company: exp.company,
      role: exp.title,
      start_date: exp.start_date || null,
      end_date: exp.end_date || null,
      bullets: (exp.bullets || []).map((b) => ({ id: b.id, text: b.text })),
    });
  }
  for (const proj of structuredResume.projects || []) {
    sections.push({
      kind: 'projects',
      entry_id: proj.id,
      company: proj.company || null,
      role: proj.title || null,
      start_date: proj.start_date || null,
      end_date: proj.end_date || null,
      bullets: (proj.bullets || []).map((b) => ({ id: b.id, text: b.text })),
    });
  }

  return {
    system: `You break resume bullets into atoms — single self-contained facts that can be selected and recomposed into different resumes for different jobs.

WHY ATOMIZE:
A bullet like "Increased revenue 1.8x by enhancing Core Auction Platform Tech, achieving ₹350+cr in 2024" is THREE distinct claims:
  - The platform tech work (skill_usage)
  - The 1.8x revenue lift (achievement)
  - The ₹350cr scale (metric)

For different jobs we want to surface different atoms. A payments role wants the platform-tech atom. An exec role wants the scale atom. A growth role wants the lift atom.

ATOM TYPES:
- 'achievement' — concrete outcome with a metric or specific result ("drove 40% retention lift")
- 'metric' — standalone quantitative fact about scope or scale ("managed $2M ARR book")
- 'skill_usage' — demonstrated use of a skill in a real context ("used SQL for cohort analysis")
- 'context' — situational background that informs framing ("led team of 4 PMs at Series B SaaS")

RULES:
- Each atom must be SELF-CONTAINED — readable with no other context.
- Each atom must be SOURCE-FAITHFUL — never invent a number, company, tool, or scope that's not in the source bullet. Paraphrase yes, fabricate never.
- Most bullets atomize into 1-3 atoms. Don't over-split (no need to make every word an atom).
- If a bullet is genuinely a single claim ("Mentored 4 junior PMs"), output ONE atom.
- Confidence 0.95 by default — these come from the user's own resume so we trust them. Drop to 0.7 only if the source bullet is vague (no metric, no specific claim).
- Tags: 1-4 lowercase keywords for retrieval. Specific and reusable: ['retention', 'lifecycle-email'] not ['work', 'stuff']. Use kebab-case.
- For 'metric' type, ALWAYS include the structured "metric" object with value/unit/type.
- For 'achievement' type, include "metric" when the bullet has one.
- Inherit company/role from the source entry — don't restate it in the atom's "fact" if it adds no new info ("at Acme" is fine to skip when company=Acme).

OUTPUT FORMAT:
Return ONLY valid JSON — no markdown, no code fences. Schema:
{
  "atoms": [
    {
      "source_bullet_id": "b_001",
      "source_entry_id": "exp_001",
      "nugget_type": "achievement" | "metric" | "skill_usage" | "context",
      "company": "string or null",
      "role": "string or null",
      "start_date": "YYYY-MM or YYYY-MM-DD or null",
      "end_date": "YYYY-MM or null (or 'present')",
      "fact": "Self-contained statement, 1 sentence",
      "metric": { "value": 1.8, "unit": "x", "type": "revenue_lift" } | null,
      "tags": ["tag1", "tag2"],
      "confidence": 0.95
    }
  ]
}

Date handling: copy start_date/end_date from the source entry onto each atom (used for recency-weighting in selection later). If the source entry has no dates, use null.`,

    user: `Atomize every bullet in this resume. Return one atoms array covering ALL bullets across ALL experience and project entries.

RESUME:
${JSON.stringify({ sections }, null, 1)}`,
  };
}
