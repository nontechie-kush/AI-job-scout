/**
 * Job matching prompt for Claude Haiku.
 * Scores up to 10 jobs at once against a candidate profile.
 * Returns a JSON array of scores in the same order as input.
 *
 * Design principle: explicit user intent (target_roles) drives everything.
 * CV content is only used to assess fit WITHIN the target function.
 * Never use CV keywords to find "similar" roles across functions.
 */

export function buildMatchPrompt(candidate, jobs) {
  const jobsPayload = jobs.map((j, i) => ({
    i,
    title: j.title,
    company: j.company,
    location: j.location || 'Not specified',
    remote: j.remote_type,
    dept: j.department || '',
    description: (j.description || '').slice(0, 600),
  }));

  const seeking = candidate.target_roles || candidate.title || 'Not specified';

  return `You are CareerPilot's matching engine. Score each job in two steps.

── WHAT THIS CANDIDATE IS SEEKING ──
Roles: ${seeking}
Location: ${candidate.location_pref}
Track: ${candidate.ic_or_lead} | Stage pref: ${candidate.stage_pref}

── WHAT THEY BRING ──
Current title: ${candidate.title} (${candidate.seniority}, ${candidate.years_exp} yrs)
Skills: ${candidate.skills}
Strongest card: ${candidate.strongest_card}

── TWO-STEP SCORING ──

STEP 1 — INTENT MATCH (non-negotiable gate):
Does the job title/function match what the candidate is SEEKING?
If NO → score ≤ 10. Stop here.
Do NOT use past experience keywords (tools, industries, companies) to find "related" roles.
The candidate stated what they want — only match that.

Examples:
  Seeking "Marketing Manager" + job "Account Executive" → ≤ 10 (Sales ≠ Marketing)
  Seeking "Marketing Manager" + job "Engagement Manager" (consulting) → ≤ 10 (Management consulting ≠ Marketing)
  Seeking "Marketing Manager" + job "Growth Marketing Lead" → proceed to Step 2
  Seeking "Product Manager" + job "Software Engineer" → ≤ 10 (Engineering ≠ Product)
  Seeking "Product Manager" + job "Senior PM" → proceed to Step 2

STEP 2 — FIT QUALITY (only for jobs that pass Step 1):
How well does the candidate's background set them up for THIS specific role?
  - Seniority match (years exp vs. role level)
  - Skills overlap with role requirements
  - Location / remote match
  - Company stage alignment
Score 40–100 based on how competitive they'd be.

JOBS (${jobs.length}):
${JSON.stringify(jobsPayload, null, 1)}

Return ONLY a JSON array (same order, same count):
[
  {"score":82,"match_reasons":["5 yrs PM exp matches senior requirement","B2B SaaS matches role context"],"gap_analysis":["Requires fintech domain — candidate is B2C"]},
  ...
]

Scoring guide: 85+=exceptional fit 70-84=strong 55-69=good 40-54=partial ≤10=function mismatch
match_reasons: 1-3 specific items | gap_analysis: 0-2 items | raw JSON only, no prose`;
}
