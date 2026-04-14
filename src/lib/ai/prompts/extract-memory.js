/**
 * Prompt builder for the Memory Extractor agent.
 *
 * After a resume conversation finalizes, this agent reads the conversation
 * and extracts durable nuggets — facts that will still be true next month
 * and that could be useful when tailoring a DIFFERENT resume later.
 *
 * Uses Claude Haiku (cheap, fast, ~$0.001 per session).
 */

/**
 * @param {Array}  conversation — [{role: 'pilot'|'user', text}]
 * @param {object} context — { company, role } optional hints from job target
 * @returns {{ system: string, user: string }}
 */
export function buildExtractMemoryPrompt(conversation = [], context = {}) {
  const historyBlock = conversation
    .map((m) => `${m.role === 'pilot' ? 'PILOT' : 'USER'}: ${m.text}`)
    .join('\n');

  const contextBlock = context.company || context.role
    ? `\nCONVERSATION CONTEXT (what job was being targeted):\n- Company: ${context.company || 'unknown'}\n- Role: ${context.role || 'unknown'}\n`
    : '';

  return {
    system: `You extract durable facts about a job seeker from resume-coaching conversations.

Your output will be stored in a personal knowledge graph and reused to help this same user tailor future resumes. Good nuggets save the user from answering the same STAR questions over and over.

WHAT TO EXTRACT:
- 'achievement' — concrete outcomes with metrics or specifics ("drove 40% retention lift via lifecycle email at Acme")
- 'skill_usage' — demonstrated use of a skill in a real context ("used SQL for cohort analysis when defining activation at Acme")
- 'context' — situational background that informs bullet framing ("led team of 4 PMs, reported to CPO at Series B SaaS")
- 'metric' — standalone quantitative facts about past work ("managed $2M ARR book of business")

WHAT NOT TO EXTRACT:
- Anything speculative or not clearly stated by the user
- Anything about the target job (that's transient)
- Generic skills without context ("knows Python") — only capture when tied to how/where used
- Duplicate facts (consolidate into one)
- The user's feelings, preferences, or meta-commentary

RULES:
- Each fact must be self-contained — it should make sense when pulled into a different conversation months later.
- Attribute to company and role when possible.
- Include metrics in the "fact" text AND as a structured "metric" field.
- Tags should be specific and reusable: ['retention', 'lifecycle-email'] not ['work', 'stuff'].
- Confidence 0.9+ only when user stated it plainly. 0.6-0.8 when inferred. Skip anything below 0.5.
- If the conversation has no durable nuggets worth saving, return an empty array. Do NOT invent.

RESPONSE FORMAT:
Return ONLY valid JSON — no markdown, no code fences.
{
  "nuggets": [
    {
      "nugget_type": "achievement" | "skill_usage" | "context" | "metric",
      "company": "string or null",
      "role": "string or null",
      "fact": "Self-contained statement, 1-2 sentences",
      "metric": { "value": 40, "unit": "percent", "type": "retention_lift" } | null,
      "tags": ["tag1", "tag2"],
      "confidence": 0.85
    }
  ]
}`,

    user: `${contextBlock}
CONVERSATION:
${historyBlock}

Extract durable nuggets from the USER's statements above. Return the JSON object.`,
  };
}

/**
 * Prompt builder to retrieve relevant nuggets for a new tailoring session.
 * This is a lightweight scorer — not a full Claude call — that runs in-process.
 * It ranks nuggets by tag overlap with gap tags + recency.
 *
 * @param {Array} allNuggets — user's nuggets from DB
 * @param {Array} gapTags — tags derived from the gaps for the new job
 * @param {number} limit — max nuggets to return (default 8)
 * @returns {Array} ranked nuggets
 */
export function rankRelevantNuggets(allNuggets = [], gapTags = [], limit = 8) {
  if (!allNuggets.length) return [];

  const gapTagSet = new Set(gapTags.map((t) => t.toLowerCase()));

  const scored = allNuggets.map((n) => {
    const nuggetTags = (n.tags || []).map((t) => t.toLowerCase());
    const overlap = nuggetTags.filter((t) => gapTagSet.has(t)).length;

    // Recency: boost recently extracted nuggets slightly
    const daysOld = (Date.now() - new Date(n.extracted_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - daysOld / 180); // decays over 6 months

    const score = overlap * 10 + (n.confidence || 0.5) * 2 + recencyBoost;
    return { ...n, _score: score };
  });

  return scored
    .filter((n) => n._score > 2) // minimum relevance threshold
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

/**
 * Formats nuggets as a prompt block for the Content Creator agent.
 *
 * @param {Array} nuggets
 * @returns {string} formatted block, or empty string if no nuggets
 */
export function formatNuggetsForPrompt(nuggets = []) {
  if (!nuggets.length) return '';

  const lines = nuggets.map((n) => {
    const where = [n.company, n.role].filter(Boolean).join(' · ');
    return `- [${n.nugget_type}${where ? ` @ ${where}` : ''}] ${n.fact}`;
  });

  return `
WHAT YOU ALREADY KNOW ABOUT THIS USER (from prior conversations):
${lines.join('\n')}

Use these facts to avoid re-asking questions the user has answered before. If a gap maps cleanly to an existing nugget, propose a bullet directly using that fact — skip the STAR interrogation.
`;
}
