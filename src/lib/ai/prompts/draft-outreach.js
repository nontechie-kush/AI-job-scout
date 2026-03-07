/**
 * Prompt builder for Claude-generated recruiter outreach messages.
 *
 * Keeps messages short, direct, and in Pilot voice:
 * - No "I hope this finds you well"
 * - References the recruiter's actual specialization / placements
 * - Ends with a single clear ask
 */

/**
 * Build the outreach message prompt.
 *
 * @param {object} userProfile  — profiles.parsed_json (from Supabase)
 * @param {object} userPrefs    — users row (target_roles, locations, ic_or_lead, salary_min)
 * @param {object} recruiter    — recruiters row
 * @returns {string} prompt
 */
export function buildOutreachPrompt(userProfile, userPrefs, recruiter) {
  const parsed = userProfile?.parsed_json || {};
  const name = parsed.name || 'the candidate';
  const seniority = parsed.seniority || '';
  const yearsExp = parsed.years_exp ? `${parsed.years_exp} years` : '';
  const skills = (parsed.skills || []).slice(0, 5).join(', ') || 'software engineering';
  const strongestCard = parsed.strongest_card || '';
  const recentCompany = (parsed.companies || [])[0] || '';
  const targetRoles = (userPrefs?.target_roles || []).join(', ') || 'engineering';

  const recName = recruiter.name;
  const recTitle = recruiter.title || 'Recruiter';
  const recCompany = recruiter.current_company || '';
  const placements = (recruiter.placements_at || []).slice(0, 3).join(', ') || 'various companies';
  const specialization = (recruiter.specialization || []).map((s) => {
    const map = { engineering: 'engineering', pm: 'product management', design: 'design', leadership: 'leadership' };
    return map[s] || s;
  }).join(' and ');
  const geography = (recruiter.geography || []).join(', ');

  const recFirstName = recName.split(' ')[0];

  return `You are Pilot, an AI job agent drafting a short LinkedIn message on behalf of a job seeker asking for a referral.

CANDIDATE:
- Name: ${name}
- Seniority: ${seniority || 'experienced'}
- Years of experience: ${yearsExp || 'several years'}
- Key skills: ${skills}
- Strongest card: ${strongestCard || 'strong technical execution'}
- Most recent company: ${recentCompany || 'a product company'}
- Looking for: ${targetRoles}

RECRUITER:
- First name: ${recFirstName}
- Title: ${recTitle}
- Company: ${recCompany}
- Specialization: ${specialization}
- Known placements at: ${placements}

TASK:
Write a short LinkedIn DM (3–4 sentences, max 150 words). This is a warm referral ask — not a networking pitch.

Structure (follow this order):
1. Start with "Hi ${recFirstName},"
2. One sentence: who the candidate is — name, most recent company, one specific achievement or skill that makes them stand out
3. One sentence: "I'm currently exploring ${targetRoles} opportunities" — optionally mention why this recruiter (e.g. saw they've placed at X)
4. Closing ask — explicit, warm, low-friction: something like "It would be great if you could put in a referral or let me know if there's an opening that fits."
5. Sign off with just the candidate's first name

Rules:
- Do NOT say "I hope this finds you well", "I came across your profile", "passionate", "excited to join", or "leverage"
- Do NOT open with the recruiter's work or compliment them — open with the greeting then the candidate intro
- The ask must explicitly mention "referral" — not just "a call" or "connect"
- Keep it warm and human, not transactional

Tone: Warm. Direct. Confident but not arrogant. Like reaching out to a senior person you respect.

Output the message text only — no subject line, no preamble, no commentary.`;
}
