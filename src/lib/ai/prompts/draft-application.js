/**
 * Prompt builder for Claude-generated job application materials.
 *
 * Generates three artifacts in one call:
 *   cover_letter   — 3 paragraphs, ~150 words, first person, specific to this job
 *   bio            — 2-sentence professional summary, ~50 words
 *   screening_qa   — array of {question, answer} for portal screening questions
 *
 * Question handling:
 *   - hasRealQuestions=true  → questions came from ATS API or DB (exact form questions)
 *                              Claude answers them specifically
 *   - hasRealQuestions=false → Claude generates role-specific questions from the
 *                              job description content (not just the title)
 */

/**
 * @param {object}  job              — jobs row from Supabase
 * @param {object}  parsedProfile    — profiles.parsed_json
 * @param {Array}   knownQuestions   — [{question, required}] from ATS API or company_application_flows
 * @param {boolean} hasRealQuestions — whether knownQuestions are actual form questions
 * @param {string}  applyContext     — 'standard' | 'naukri_native' | 'iimjobs_native'
 * @returns {{ system: string, user: string }}
 */
export function buildApplicationPrompt(job, parsedProfile, knownQuestions = [], hasRealQuestions = false, applyContext = 'standard') {
  const p = parsedProfile || {};
  const name = p.name || 'the candidate';
  const title = p.title || '';
  const skills = (p.skills || []).slice(0, 6).join(', ') || '';
  const strongest = p.strongest_card || '';
  const yearsExp = p.years_exp ? `${p.years_exp} years` : '';
  const recentCompany = (p.companies || [])[0] || '';

  // Use more description context so generated questions are role-specific
  const descExcerpt = (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1400);

  let questionsBlock;
  if (knownQuestions.length && hasRealQuestions) {
    // These are the actual questions on the application form — answer each specifically
    questionsBlock = `These are the EXACT questions on the ${job.company} application form. Answer each one specifically using the candidate's background:
${knownQuestions.map((q, i) => `${i + 1}. ${q.question}${q.required ? ' (required)' : ''}`).join('\n')}`;
  } else if (knownQuestions.length) {
    // From our DB — likely real but not confirmed via live API
    questionsBlock = `Known screening questions for ${job.company}:
${knownQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`;
  } else {
    // No known questions — generate from the actual job description content
    questionsBlock = `No known form questions. Based on the specific skills, tools, and requirements in the ROLE CONTEXT above, generate 2–3 screening questions this company would actually ask for a ${job.title} role.
Focus on role-specific functional questions (e.g., for finance roles: P&L ownership, modeling experience; for engineering: system design, languages used; for PM: metrics, roadmap decisions) — not generic leadership or "tell me about yourself" questions. Answer each using the candidate's background.`;
  }

  const isNativeIndia = applyContext === 'naukri_native' || applyContext === 'iimjobs_native';
  const platform = applyContext === 'naukri_native' ? 'Naukri' : applyContext === 'iimjobs_native' ? 'IIMJobs' : null;

  // Naukri/IIMJobs native apply has a single short text box — not a formal cover letter.
  // The expected content is a direct, conversational message (100–150 words max).
  const coverLetterInstruction = isNativeIndia
    ? `"cover_letter": "Short cover note for ${platform} native apply. 100–150 words max. Conversational, direct — NOT a formal cover letter. 1–2 short paragraphs: what I do + one relevant achievement, why this specific role/company. No 'Dear Hiring Manager'. No formal sign-off."`
    : `"cover_letter": "3 short paragraphs, max 150 words total. Paragraph 1: who I am and why this role. Paragraph 2: one specific example of relevant impact. Paragraph 3: what I bring + clear close."`;

  return {
    system: `You are Pilot — a brutally effective job application writer.
You write in first person as the candidate. You are specific. You never say "passionate", "excited to join", "team player", or "fast learner".
CRITICAL: Your ONLY source of truth about the company is the ROLE CONTEXT provided below. Do NOT use your training knowledge about the company — it may be outdated or wrong. If something about the company is not in the role context, do not mention it.
Tone: confident, direct, human. No corporate fluff. No buzzwords.
Return ONLY valid JSON — no markdown, no preamble, no commentary.`,

    user: `Write job application materials for:

JOB: ${job.title} at ${job.company}
PORTAL: ${platform || job.apply_type || 'external'}${isNativeIndia ? ` (native ${platform} apply — cover note format, not formal cover letter)` : ''}
ROLE CONTEXT (this is your only source of truth about the company — do not add context from elsewhere):
${descExcerpt}

CANDIDATE:
- Name: ${name}
- Current/recent role: ${title}
- Most recent company: ${recentCompany}
- Top skills: ${skills}
- Strongest card: ${strongest}
- Experience: ${yearsExp}

${questionsBlock}

Return this exact JSON shape:
{
  ${coverLetterInstruction},
  "bio": "2 sentences, max 50 words. Professional summary in first person.",
  "screening_qa": [
    {"question": "...", "answer": "..."}
  ]
}`,
  };
}
