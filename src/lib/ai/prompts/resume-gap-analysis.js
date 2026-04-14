/**
 * Prompt builder for resume gap analysis against a specific job.
 *
 * Analyzes a user's structured resume vs a job description to identify:
 *   - Resume strength score (0-100)
 *   - Which existing bullets are strong/weak for this role
 *   - Missing signals that should be added
 *   - A nudge message for the UI
 *
 * Handles graceful degradation when JD is short (Naukri etc).
 */

const CONFIDENCE_RULES = {
  high: 'Full job description available. Analyze against specific requirements.',
  medium: 'Partial job description. Analyze against what is available + infer from title.',
  low: 'Very limited job description. Base analysis on job title and any skills mentioned only. Do not fabricate requirements that are not present.',
};

/**
 * @param {object} structuredResume — profiles.structured_resume JSON
 * @param {object} job — jobs row (title, company, description, requirements)
 * @param {object} matchSignals — { match_reasons: string[], gap_analysis: string[] }
 * @param {string} confidence — 'high' | 'medium' | 'low'
 * @returns {{ system: string, user: string }}
 */
export function buildResumeGapPrompt(structuredResume, job, matchSignals = {}, confidence = 'high') {
  const descRaw = (job.description || '').replace(/<[^>]+>/g, ' ').trim();
  const descExcerpt = descRaw.slice(0, 2000);

  const matchReasons = (matchSignals.match_reasons || []).slice(0, 3);
  const existingGaps = (matchSignals.gap_analysis || []).slice(0, 3);

  // Build a compact representation of the resume for the prompt
  const experienceSummary = (structuredResume.experience || []).map((exp) => ({
    id: exp.id,
    role: `${exp.title} at ${exp.company}`,
    bullets: (exp.bullets || []).map((b) => ({ id: b.id, text: b.text, tags: b.tags })),
  }));

  const projectSummary = (structuredResume.projects || []).map((proj) => ({
    id: proj.id,
    name: proj.name,
    bullets: (proj.bullets || []).map((b) => ({ id: b.id, text: b.text })),
  }));

  return {
    system: `You are Pilot — a resume strength analyzer. You compare a candidate's resume against a job description and identify exactly what's strong, what's weak, and what's missing.

${CONFIDENCE_RULES[confidence]}

Return ONLY valid JSON — no markdown, no explanation, no code fences.

Rules:
- strong_bullets: bullet IDs that directly demonstrate skills/experience the job requires
- weak_bullets: bullet IDs that are vague, irrelevant to this role, or could be replaced with something more targeted
- missing_signals: specific gaps — things the job requires that the resume doesn't mention at all. For each gap, suggest which experience entry it could be added to.
- resume_strength: 0-100 score. 80+ = strong match, 60-79 = decent with gaps, below 60 = significant gaps
- nudge_message: 1-2 sentences in Pilot voice (direct, human, no corporate speak). Tells the user the headline — how strong their resume is and what the biggest gap is.
- Do NOT fabricate job requirements. Only analyze against what's explicitly stated in the role context.
- If confidence is low, be transparent: "Limited info on this role — here's what I can see."`,

    user: `Analyze this resume against the job:

JOB: ${job.title} at ${job.company}
CONFIDENCE: ${confidence}

ROLE CONTEXT:
${descExcerpt || `[No detailed description available — analyze based on job title: ${job.title}]`}

${matchReasons.length ? `PRE-COMPUTED MATCH SIGNALS:\n${matchReasons.map((r) => `+ ${r}`).join('\n')}` : ''}
${existingGaps.length ? `PRE-COMPUTED GAPS:\n${existingGaps.map((g) => `- ${g}`).join('\n')}` : ''}

CANDIDATE RESUME:
Summary: ${structuredResume.summary || 'None'}
Skills: ${JSON.stringify(structuredResume.skills || {})}

Experience:
${JSON.stringify(experienceSummary, null, 1)}

Projects:
${JSON.stringify(projectSummary, null, 1)}

Certifications: ${JSON.stringify(structuredResume.certifications || [])}

Return this exact JSON shape:
{
  "resume_strength": <0-100>,
  "confidence": "${confidence}",
  "strong_bullets": ["b_001", "b_003"],
  "weak_bullets": ["b_002"],
  "missing_signals": [
    {
      "gap": "No mention of stakeholder management",
      "suggestion": "Add a bullet about cross-functional work",
      "section": "experience",
      "target_entry_id": "exp_001"
    }
  ],
  "reorder_suggestions": ["Move exp_002 above exp_001 for this role"],
  "nudge_message": "Your resume is solid on X but light on Y. 2 tweaks could take it from 72 to 85+."
}`,
  };
}
