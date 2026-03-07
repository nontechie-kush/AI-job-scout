/**
 * ATS email pattern detection.
 *
 * Subject is used for detection only — caller must NEVER persist it.
 * Only the derived `detected_pattern` and `senderDomain` are stored.
 */

const ATS_DOMAINS = new Set([
  'greenhouse.io',
  'lever.co',
  'ashby.io',
  'ashby.hq.com',
  'myworkdayjobs.com',
  'taleo.net',
  'linkedin.com',
  'jobs-noreply.linkedin.com',
  'noreply.linkedin.com',
  'icims.com',
  'bamboohr.com',
  'smartrecruiters.com',
  'workday.com',
  'successfactors.com',
  'jobvite.com',
  'lever.email',
]);

// Keyword sets ordered by priority (highest first)
const PATTERNS = [
  {
    type: 'offer',
    keywords: [
      'offer letter', 'pleased to offer', 'offer of employment',
      'job offer', 'compensation package', 'welcome to the team',
      'formal offer',
    ],
  },
  {
    type: 'interview',
    keywords: [
      'interview invitation', 'schedule an interview', 'invite you to interview',
      'technical screen', 'phone screen', 'video interview',
      'onsite interview', 'virtual interview', 'next steps',
      'move forward with your application', 'hiring manager would like',
      'schedule a call', 'we would like to meet',
    ],
  },
  {
    type: 'rejection',
    keywords: [
      'not moving forward', 'decided to move forward with other',
      'decided to proceed with other candidates',
      'we will not be moving forward',
      'after careful consideration, we',
      'not selected', 'not a fit at this time',
      'we have decided not to proceed', 'pursuing other candidates',
      'position has been filled',
    ],
  },
  {
    type: 'confirmation',
    keywords: [
      'received your application', 'thank you for applying',
      'thanks for applying', 'application submitted',
      'application confirmed', 'we have received your',
      'application for the position', 'application acknowledgement',
      'successfully submitted',
    ],
  },
];

/**
 * Detect pattern from subject line + context.
 *
 * Returns: 'offer' | 'interview' | 'rejection' | 'confirmation' | 'reply' | null
 */
export function detectPattern(senderDomain, subject, messageCount) {
  const subjectLower = (subject || '').toLowerCase();

  for (const { type, keywords } of PATTERNS) {
    if (keywords.some((kw) => subjectLower.includes(kw))) {
      return type;
    }
  }

  // Thread grew → someone replied
  if (messageCount > 1) return 'reply';

  // From known ATS domain but no specific pattern → probably a confirmation
  if (ATS_DOMAINS.has(senderDomain)) return 'confirmation';

  return null;
}

/**
 * Maps detected pattern to pipeline stage.
 * Returns null if no stage change warranted.
 */
export function patternToStage(pattern) {
  const MAP = {
    confirmation: 'confirmed',
    reply: 'replied',
    interview: 'interviewing',
    rejection: 'rejected',
    offer: 'offer',
  };
  return MAP[pattern] || null;
}

/**
 * Returns true if the domain belongs to a known ATS platform.
 */
export function isATSDomain(domain) {
  return ATS_DOMAINS.has(domain);
}

// Stage progression order — only advance forward, never regress
const STAGE_ORDER = [
  'applied', 'confirmed', 'replied', 'interviewing', 'offer', 'rejected',
];

/**
 * Returns true if newStage is a progression from currentStage.
 * Rejection can always override any stage.
 */
export function isStageProgression(currentStage, newStage) {
  if (newStage === 'rejected') return true; // rejection always applies
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const newIdx = STAGE_ORDER.indexOf(newStage);
  return newIdx > currentIdx;
}
