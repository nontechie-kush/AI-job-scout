/**
 * Prompt builder for Claude-generated recruiter outreach.
 *
 * Returns three formats needed for the outreach automation flow:
 *   connection_note  — ≤200 chars, hook only, gets them to accept
 *   dm_subject       — 6–8 words, used if connection limit hit
 *   dm_body          — full message, used as follow-up DM after acceptance
 */

const PILOT_MODES = {
  steady:     'Warm but minimal. No filler. Confident and respectful.',
  coach:      'Encouraging tone. Position the candidate as someone worth knowing.',
  hype:       'Confident and direct. Slightly more assertive energy.',
  unfiltered: 'Blunt and honest. No networking clichés. Say exactly what this person brings.',
};

/**
 * @param {object} userProfile     — profiles row (has parsed_json)
 * @param {object} userPrefs       — users row
 * @param {object} recruiter       — recruiters row
 * @param {string} pilotMode       — steady|coach|hype|unfiltered
 * @param {Array}  mutualConnections — [{name, profile_url}] from enrichment
 */
export function buildOutreachPrompt(userProfile, userPrefs, recruiter, pilotMode = 'steady', mutualConnections = []) {
  const parsed = userProfile?.parsed_json || {};
  const candidateName  = parsed.name || 'the candidate';
  const firstName      = candidateName.split(' ')[0];
  const seniority      = parsed.seniority || 'experienced';
  const yearsExp       = parsed.years_exp ? `${parsed.years_exp} years` : 'several years';
  const skills         = (parsed.skills || []).slice(0, 4).join(', ') || 'product';
  const strongestCard  = parsed.strongest_card || '';
  const recentCompany  = (parsed.companies || [])[0] || '';
  const targetRoles    = (userPrefs?.target_roles || []).join(', ') || 'product roles';

  const recFirstName   = recruiter.name?.split(' ')[0] || 'there';
  const recCompany     = recruiter.current_company || '';
  const placements     = (recruiter.placements_at || []).slice(0, 3).join(', ') || 'various companies';
  const specialization = (recruiter.specialization || []).join(', ');

  const mutualLine = mutualConnections.length > 0
    ? `Mutual connections: ${mutualConnections.slice(0, 2).map(m => m.name).join(' and ')}. Use one of their names naturally in the connection note if it fits.`
    : '';

  const modeDesc = PILOT_MODES[pilotMode] || PILOT_MODES.steady;

  return `You are Pilot, an AI job agent drafting LinkedIn outreach for a job seeker.
Mode: ${pilotMode} — ${modeDesc}

CANDIDATE:
- Name: ${candidateName}
- Seniority: ${seniority}, ${yearsExp} experience
- Skills: ${skills}
- Strongest card: ${strongestCard || 'strong execution'}
- Most recent company: ${recentCompany || 'a product company'}
- Looking for: ${targetRoles}

RECRUITER:
- First name: ${recFirstName}
- Company: ${recCompany}
- Specialization: ${specialization}
- Known placements at: ${placements}
${mutualLine ? `\n${mutualLine}` : ''}

TASK:
Generate three versions of outreach. Return ONLY valid JSON, no commentary.

1. connection_note: A LinkedIn connection request note. MAX 200 characters (hard limit).
   EXACT format (use \\n for newlines in JSON):
   "Hi ${recFirstName},\\nHope you are doing well. I am seeking opportunities in ${targetRoles} and it would be great to connect with you. Please accept my invite.\\n\\nThanks\\n${firstName}"
   - Keep the body sentence specific: mention the role domain, optionally the candidate's current/recent company if it adds credibility
   - If mutual connections exist, replace "Hope you are doing well" with "We have [mutual name] in common."
   - Do NOT add any other lines or sentences
   - The \\n\\nThanks\\n${firstName} sign-off is mandatory

2. dm_subject: Subject line for a LinkedIn DM (used if connection limit hit).
   - 6–8 words, specific to candidate + recruiter
   - e.g. "PM at CARS24 — exploring Series B roles"

3. dm_body: Full LinkedIn DM message (100–150 words).
   - 3–4 sentences
   - Sentence 1: who the candidate is + one specific achievement
   - Sentence 2: what they're looking for + why this recruiter (reference their placements)
   - Sentence 3: explicit ask — mention "referral" not just "a call"
   - Sign off with candidate's first name only
   - NO "I hope this finds you well", "passionate", "excited to join", "leverage", "synergy"

Return format:
{"connection_note":"...","dm_subject":"...","dm_body":"..."}`;
}
