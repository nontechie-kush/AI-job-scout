/**
 * Prompt builder for converting raw resume text into a structured, editable JSON document.
 *
 * The structured resume has addressable sections with bullet IDs and tags,
 * enabling the Resume Tailor Service agents to target specific content for editing.
 *
 * Output schema:
 *   summary       — 2-3 sentence professional summary
 *   experience[]  — reverse-chronological, each with bullets[{id, text, tags}]
 *   education[]   — degrees with optional bullets
 *   skills        — grouped: technical, domain, tools
 *   projects[]    — optional, with bullets
 *   certifications[] — flat list
 *   version       — always 1 for initial structuring
 */

/**
 * @param {string} rawText — raw resume text from profiles.raw_text
 * @returns {{ system: string, user: string }}
 */
export function buildResumeStructurePrompt(rawText) {
  return {
    system: `You are a resume parsing engine. Your job is to convert raw resume text into a structured JSON document that can be programmatically edited.

Return ONLY valid JSON — no markdown, no explanation, no code fences. Just raw JSON.

Rules:
- Generate a unique short ID for each experience entry (exp_001, exp_002, ...), education entry (edu_001, ...), project entry (proj_001, ...), and bullet point (b_001, b_002, ..., pb_001, ...).
- IDs must be unique across the entire document.
- Each bullet point must have 1-3 tags — short lowercase keywords describing the bullet's theme (e.g. "revenue-growth", "team-leadership", "product-launch", "data-analysis").
- Tags should be specific enough to match against job requirements but general enough to be reusable.
- Preserve the candidate's original wording as closely as possible — do NOT rewrite bullets. Only fix obvious typos or formatting issues.
- If a section is not present in the resume, use an empty array or null.
- Experience entries must be in reverse chronological order (most recent first).
- Dates should be normalized to "YYYY-MM" format where possible. Use "present" for current roles.
- If the resume has a summary/objective section, extract it. If not, leave summary as null.
- Skills should be categorized into technical (programming, frameworks, tools), domain (industries, verticals), and tools (software products). If categorization is ambiguous, use your best judgment.
- Certifications should be a flat array of strings.`,

    user: `Convert this resume into structured JSON:

---
${rawText.slice(0, 12000)}
---

Return this exact JSON shape:
{
  "summary": "2-3 sentence professional summary from the resume, or null if not present",
  "experience": [
    {
      "id": "exp_001",
      "company": "Company Name",
      "title": "Job Title",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM or present",
      "location": "City, Country or null",
      "bullets": [
        { "id": "b_001", "text": "Original bullet point text", "tags": ["tag1", "tag2"] }
      ]
    }
  ],
  "education": [
    {
      "id": "edu_001",
      "institution": "University Name",
      "degree": "Degree Name",
      "year": "YYYY",
      "bullets": []
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "domain": ["domain1"],
    "tools": ["tool1", "tool2"]
  },
  "projects": [
    {
      "id": "proj_001",
      "name": "Project Name",
      "bullets": [
        { "id": "pb_001", "text": "Project bullet text", "tags": ["tag1"] }
      ]
    }
  ],
  "certifications": ["Cert Name 1"],
  "version": 1
}`,
  };
}
