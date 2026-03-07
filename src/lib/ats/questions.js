/**
 * Fetches actual application form questions from ATS public APIs.
 *
 * Greenhouse, Lever, and Ashby all expose unauthenticated job board APIs
 * that return real screening questions — the same ones rendered on the form.
 * This means Pilot Kit answers always match what the user actually sees.
 *
 * Exports:
 *   fetchATSQuestions(applyUrl) → [{question, required}] | []
 *   parseATSUrl(applyUrl) → { ats, companyToken, jobId } | null
 */

// Standard fields we skip — we only want text screening questions,
// not resume uploads, name/email fields, demographic questions, etc.
const BOILERPLATE_KEYWORDS = [
  'resume', 'cv', 'cover letter', 'first name', 'last name', 'email',
  'phone', 'address', 'linkedin', 'website', 'portfolio', 'location',
  'city', 'state', 'country', 'zip', 'postal', 'how did you hear',
  'referral', 'authorized to work', 'require sponsorship', 'visa',
  'salary expectation', 'desired salary', 'compensation',
  'pronouns', 'gender', 'race', 'ethnicity', 'veteran', 'disability',
  'legal name', 'date of birth',
];

function isBoilerplate(label = '') {
  const l = label.toLowerCase();
  return BOILERPLATE_KEYWORDS.some((kw) => l.includes(kw));
}

/**
 * Parse an ATS apply URL into its components.
 * Returns null if URL doesn't match a known ATS pattern.
 *
 * Supported:
 *   Greenhouse: boards.greenhouse.io/COMPANY/jobs/JOB_ID
 *               job-boards.greenhouse.io/COMPANY/jobs/JOB_ID
 *   Lever:      jobs.lever.co/COMPANY/UUID
 *   Ashby:      jobs.ashbyhq.com/COMPANY/UUID
 */
export function parseATSUrl(applyUrl) {
  if (!applyUrl) return null;

  // Greenhouse (numeric job ID)
  const gh = applyUrl.match(/greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/);
  if (gh) return { ats: 'greenhouse', companyToken: gh[1], jobId: gh[2] };

  // Lever (UUID job ID)
  const lv = applyUrl.match(/jobs\.lever\.co\/([^/?#]+)\/([a-f0-9-]{36})/i);
  if (lv) return { ats: 'lever', companyToken: lv[1], jobId: lv[2] };

  // Ashby (UUID job ID)
  const ab = applyUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([a-f0-9-]{36})/i);
  if (ab) return { ats: 'ashby', companyToken: ab[1], jobId: ab[2] };

  return null;
}

// ── ATS-specific fetchers ──────────────────────────────────────────────────

async function fetchGreenhouseQuestions(companyToken, jobId) {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${companyToken}/jobs/${jobId}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) return [];

  const data = await res.json();

  return (data.questions || [])
    // Only text fields — skip file uploads, checkboxes, selects
    .filter((q) => q.fields?.some((f) => f.type === 'textarea' || f.type === 'input_text'))
    .filter((q) => !isBoilerplate(q.label))
    .map((q) => ({ question: q.label.trim(), required: q.required ?? false }));
}

async function fetchLeverQuestions(companyToken, jobId) {
  const res = await fetch(
    `https://api.lever.co/v0/postings/${companyToken}/${jobId}?mode=json`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) return [];

  const data = await res.json();

  // Lever stores custom questions in additionalCards
  const questions = [];
  for (const card of data.additionalCards || []) {
    if (card.type !== 'textarea' && card.type !== 'input') continue;
    const label = (card.text || '').trim();
    if (label && !isBoilerplate(label)) {
      questions.push({ question: label, required: card.required ?? false });
    }
  }
  return questions;
}

async function fetchAshbyQuestions(companyToken, jobId) {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${companyToken}/job-posting/${jobId}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) return [];

  const data = await res.json();

  const questions = [];
  for (const section of data.applicationForm?.sections || []) {
    for (const field of section.fields || []) {
      // LongText = textarea, ShortText = short text input
      if (field.inputType !== 'LongText' && field.inputType !== 'ShortText') continue;
      const label = (field.label || '').trim();
      if (label && !isBoilerplate(label)) {
        questions.push({ question: label, required: field.isRequired ?? false });
      }
    }
  }
  return questions;
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches real screening questions from the ATS public API.
 * Returns [] if the URL doesn't match a supported ATS, the API fails,
 * or the request times out — caller should fall back to DB or generation.
 */
export async function fetchATSQuestions(applyUrl) {
  try {
    const parsed = parseATSUrl(applyUrl);
    if (!parsed) return [];

    switch (parsed.ats) {
      case 'greenhouse': return await fetchGreenhouseQuestions(parsed.companyToken, parsed.jobId);
      case 'lever':      return await fetchLeverQuestions(parsed.companyToken, parsed.jobId);
      case 'ashby':      return await fetchAshbyQuestions(parsed.companyToken, parsed.jobId);
      default:           return [];
    }
  } catch {
    // Timeout, network error, API change — silently fall back
    return [];
  }
}
