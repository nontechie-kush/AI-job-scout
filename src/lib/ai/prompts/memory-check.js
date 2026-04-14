/**
 * Prompt builder for the Memory Check agent.
 *
 * Given a list of gaps and the user's stored experience nuggets,
 * this agent decides which gaps can be answered from memory alone
 * vs. which still need user input. For gaps that CAN be answered,
 * it drafts the bullet point directly so the user can skip the chat.
 *
 * Uses Claude Haiku — cheap, fast, runs before the chat even opens.
 */

/**
 * @param {Array}  gaps — [{gap, suggestion, section, target_entry_id}]
 * @param {Array}  nuggets — relevant user_experience_memory rows
 * @param {object} jobContext — { title, company, description } or null
 * @returns {{ system: string, user: string }}
 */
export function buildMemoryCheckPrompt(gaps = [], nuggets = [], jobContext = null) {
  const jobBlock = jobContext
    ? `TARGET JOB: ${jobContext.title} at ${jobContext.company}`
    : 'TARGET: General resume update';

  const nuggetsBlock = nuggets.length > 0
    ? nuggets
        .map((n) => {
          const where = [n.company, n.role].filter(Boolean).join(' · ');
          return `- [${n.nugget_type}${where ? ` @ ${where}` : ''}] ${n.fact} (tags: ${(n.tags || []).join(', ')})`;
        })
        .join('\n')
    : '(no stored memory for this user yet)';

  const gapsBlock = gaps
    .map((g, i) => `${i + 1}. ${g.gap} — ${g.suggestion || ''}`)
    .join('\n');

  return {
    system: `You decide whether a resume gap can be filled from stored user memory OR needs fresh user input.

FOR EACH GAP, decide:
- "covered": true if one or more stored nuggets give you enough concrete, specific material to write a strong bullet WITHOUT guessing or padding.
- "covered": false if the nuggets don't contain relevant specifics, OR if the gap is about something the user hasn't shared before.

RULES:
- Do NOT fabricate. If the nugget says "led retention project" but has no metric, and the gap asks for a quantified retention win, mark as NOT covered — you need the user to provide the metric.
- Only mark "covered" when the proposed bullet can be written using facts the user actually stated.
- Use the nugget's attribution — company, role, metrics — exactly as stored.
- When covered, write the proposed bullet in 1-2 lines, strong action verb, include the metric.
- When NOT covered, briefly note what's missing ("need specifics on the retention metric") so the chat agent knows what to ask.

RESPONSE FORMAT:
Return ONLY valid JSON — no markdown, no code fences.
{
  "coverage": [
    {
      "gap_index": 0,
      "covered": true,
      "evidence_nugget_ids": ["uuid1", "uuid2"],
      "proposed_bullet": "Drove 40% retention lift via lifecycle email redesign at Acme, lifting 90-day cohort retention from 28% to 39%.",
      "target_section": "experience",
      "target_entry_hint": "Acme"
    },
    {
      "gap_index": 1,
      "covered": false,
      "evidence_nugget_ids": [],
      "missing": "Need specifics on what the B2B SaaS work looked like — which customers, what segment."
    }
  ]
}`,

    user: `${jobBlock}

STORED NUGGETS (things the user has already shared in prior sessions):
${nuggetsBlock}

GAPS TO EVALUATE:
${gapsBlock}

For each gap, decide covered vs not. Return the JSON object.`,
  };
}
