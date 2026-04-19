/**
 * Prompt builder for editing the user's original resume HTML to apply tailored
 * content while preserving the original visual design.
 *
 * Inputs:
 *   originalHtml      — the semantic HTML captured at onboarding (vision pass)
 *   pageCount         — number of pages in the original PDF (1, 2, ...)
 *   tailoredVersion   — structured JSON of the edited resume from the Tailor flow
 *   jobContext        — { title, company, description } for the target role
 *
 * Output: a complete HTML document with the same visual design as the original,
 * but with bullets / sections updated to match `tailoredVersion`.
 */

export function buildResumeHtmlTailorPrompt({
  originalHtml,
  pageCount,
  tailoredVersion,
  jobContext,
}) {
  const system = `You are a senior resume designer. The user has an existing HTML resume with a specific visual design (fonts, spacing, borders, alignment). You must produce a NEW HTML document that:

1. PRESERVES the original visual design exactly — same fonts, colors, borders, padding, alignment patterns, bullet markers, section header styling.
2. APPLIES the tailored content from the structured JSON — replace bullets, add new sections, adjust bolding as the JSON dictates.
3. MATCHES the original page count (${pageCount} page${pageCount === 1 ? '' : 's'}). Do not change page count unless content volume genuinely forces it. Tighten or relax spacing within reason to fit.

OUTPUT RULES
- Output ONLY HTML, starting with <!DOCTYPE html> and ending with </html>. No markdown fences. No commentary.
- Inline <style> in <head>. No external resources, no images, no @import, no fonts.googleapis.
- Keep @page { size: letter; margin: 0; } and the .page wrapper from the original.

EDITING RULES
- Where a bullet in the JSON has "text" that differs from the original, replace it.
- Where the JSON has new bullets the original lacks, add them in the same visual style as siblings.
- Where the original has bullets not represented in the JSON, drop them.
- Sections in the JSON not present in the original (e.g. a new "Achievements" block) should be added with section header styling that matches the existing section headers (same font weight, casing, spacing).
- Bold key metrics, named features, and bullet-leading verbs the same way the original does — wrap in <strong>. Do not bold randomly.
- Keep semantic structure: <header>, <section>, <h1>/<h2>/<h3>, <ul>, <li>, <strong>, <em>, <u>.

FIT RULE (critical)
- Output must be ${pageCount} page${pageCount === 1 ? '' : 's'}. If content is light, increase section margin-bottom (10–14px) and bullet margin-bottom (3–5px). If content is heavy, decrease to 4–8px section margin and 1–2px bullet margin, or drop body to 10pt. Never let content end before 85% of page height. Never spill to an extra page.`;

  const user = `Here is the user's ORIGINAL resume HTML (preserve its design):

---ORIGINAL HTML START---
${originalHtml}
---ORIGINAL HTML END---

Here is the TAILORED CONTENT (apply to the design above):

---TAILORED JSON START---
${JSON.stringify(tailoredVersion, null, 2)}
---TAILORED JSON END---

Target role context (for tone / emphasis judgment, do NOT mention the company by name in the resume body):

${JSON.stringify(jobContext, null, 2)}

Produce one complete HTML document that LOOKS like the original but READS like the tailored JSON. ${pageCount} page${pageCount === 1 ? '' : 's'} total.`;

  return { system, user };
}
