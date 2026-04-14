/**
 * Prompt builder for the Resume Content Creator agent.
 *
 * This agent has a conversational flow:
 *   1. Asks STAR-framework questions to understand the user's experience
 *   2. Crafts bullet points from the user's answers
 *   3. Proposes specific changes (replace/add) to the resume
 *   4. Gets user approval before finalizing
 *
 * The agent only sees the relevant section of the resume (not the full document)
 * to save tokens and keep focus.
 */

const PILOT_MODES = {
  steady: 'Calm and methodical. Ask clear questions. No hype.',
  coach: 'Encouraging. Build confidence. Help them see their own strengths.',
  hype: 'High energy. Make them feel like their experience is impressive.',
  unfiltered: 'Brutally honest. If a bullet is weak, say so directly.',
};

/**
 * @param {object}  structuredResume — full structured resume JSON
 * @param {Array}   gaps — missing_signals from gap analysis [{gap, suggestion, section, target_entry_id}]
 * @param {Array}   conversationHistory — [{role: 'pilot'|'user', text}]
 * @param {string}  pilotMode — 'steady' | 'coach' | 'hype' | 'unfiltered'
 * @param {object}  jobContext — { title, company, description } or null for general updates
 * @param {string}  memoryBlock — formatted nuggets from user_experience_memory (optional)
 * @returns {{ system: string, user: string }}
 */
export function buildContentCreatorPrompt(structuredResume, gaps = [], conversationHistory = [], pilotMode = 'steady', jobContext = null, memoryBlock = '') {
  const modeDesc = PILOT_MODES[pilotMode] || PILOT_MODES.steady;

  // Build targeted context — only the sections relevant to gaps
  const targetEntryIds = new Set(gaps.map((g) => g.target_entry_id).filter(Boolean));
  const relevantExperience = targetEntryIds.size > 0
    ? (structuredResume.experience || []).filter((exp) => targetEntryIds.has(exp.id))
    : (structuredResume.experience || []).slice(0, 3); // fallback: most recent 3

  const resumeContext = {
    summary: structuredResume.summary,
    skills: structuredResume.skills,
    relevantExperience: relevantExperience.map((exp) => ({
      id: exp.id,
      role: `${exp.title} at ${exp.company} (${exp.start_date} – ${exp.end_date || 'present'})`,
      bullets: exp.bullets,
    })),
  };

  // Format conversation history for the prompt
  const historyBlock = conversationHistory.length > 0
    ? `\nCONVERSATION SO FAR:\n${conversationHistory.map((m) => `${m.role === 'pilot' ? 'PILOT' : 'USER'}: ${m.text}`).join('\n')}\n`
    : '';

  const gapsBlock = gaps.length > 0
    ? `\nGAPS TO ADDRESS:\n${gaps.map((g, i) => `${i + 1}. ${g.gap} → Suggestion: ${g.suggestion} (target: ${g.target_entry_id || 'any section'})`).join('\n')}`
    : '';

  const jobBlock = jobContext
    ? `\nTARGET JOB: ${jobContext.title} at ${jobContext.company}\nROLE CONTEXT: ${(jobContext.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800)}`
    : '\nMODE: General resume update (no specific job target)';

  return {
    system: `You are Pilot — a resume coach helping a real person improve their resume through conversation.

IMPORTANT CONTEXT: You are one part of a resume tailoring pipeline. After you finish proposing changes, the system automatically generates an updated PDF resume for the user. You do NOT need to explain this limitation or manage expectations about PDFs. Your ONLY job is to help improve the resume content. The PDF generation happens automatically after your work.

Your approach:
1. UNDERSTAND first — ask about their experience using the STAR framework (Situation, Task, Action, Result). One question at a time. Keep questions short and specific.
2. CRAFT bullet points — once you have enough context, write a bullet point that is specific, quantified where possible, and highlights impact.
3. PROPOSE changes — tell the user exactly which existing bullet to replace or where to add the new one. Always explain why. Propose changes using the structured format below — the UI will render them as accept/reject cards.
4. Keep going until all gaps are addressed or the user says they're done.

Tone: ${pilotMode} — ${modeDesc}
You speak like Cooper from Interstellar — direct, human, owns failures. Never clinical. Never say "passionate", "leveraged", "utilized", or "spearheaded".

CRITICAL RULES:
- Ask ONE question at a time. Do not overwhelm with multiple questions.
- Each bullet point must be 1-2 lines max. Start with a strong action verb. Include a metric or outcome where possible.
- When proposing a replacement, show both the old and new text so the user can compare.
- If the user's answer is too vague, push back: "That's a start, but I need specifics. How many? What changed? What was the result?"
- Never fabricate metrics or outcomes. If the user doesn't provide numbers, write the bullet without them.
- NEVER say you can't generate a PDF, can't edit the resume directly, or disclaim your capabilities. You are part of a system that handles all of that. Just focus on the content.
- When starting a conversation, jump straight into the first gap. No lengthy introductions or explanations of your process.

RESPONSE FORMAT:
Return ONLY valid JSON — no markdown, no code fences.
{
  "response": "Your conversational message to the user",
  "proposed_changes": [],
  "stage": "collecting" | "proposing" | "finalized"
}

When stage is "proposing", proposed_changes should contain:
[
  {
    "id": "change_001",
    "action": "replace" | "add",
    "section": "experience" | "projects",
    "entry_id": "exp_001",
    "bullet_id": "b_002 or null for add",
    "before": "old text (null for add)",
    "after": "new bullet text"
  }
]

When collecting info (stage="collecting"), proposed_changes is empty [].
When all changes are accepted (stage="finalized"), proposed_changes is empty [].`,

    user: `${jobBlock}
${gapsBlock}
${memoryBlock}
CURRENT RESUME (relevant sections):
${JSON.stringify(resumeContext, null, 1)}
${historyBlock}
Continue the conversation. If this is the start, introduce yourself briefly and ask about the first gap. If mid-conversation, respond to the user's last message.`,
  };
}
