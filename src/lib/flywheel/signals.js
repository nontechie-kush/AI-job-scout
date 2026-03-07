/**
 * Flywheel signal recording utilities.
 *
 * All signals are anonymised — user_id is NEVER stored.
 * profile_archetype_hash is derived from (seniority + top_3_skills) only.
 *
 * Usage (fire-and-forget — do NOT await in request handlers):
 *
 *   recordSignal(serviceClient, {
 *     type: 'dismissal_reason',
 *     dismissed_reason: 'too_senior',
 *     company_domain: 'stripe.com',
 *   });
 */

import crypto from 'crypto';

/**
 * Derive a short, non-reversible archetype hash from parsed profile data.
 * Safe to store — cannot be traced back to any individual.
 *
 * @param {object} parsedJson — profiles.parsed_json
 * @returns {string} 16-char hex hash
 */
export function makeArchetypeHash(parsedJson = {}) {
  const seniority = (parsedJson.seniority || 'unknown').toLowerCase().trim();
  const skills = (parsedJson.skills || [])
    .map((s) => s.toLowerCase().trim())
    .sort()
    .slice(0, 3)
    .join(',');
  return crypto
    .createHash('sha256')
    .update(`${seniority}|${skills}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Record an anonymised flywheel signal.
 * Non-fatal — logs warning on failure, never throws.
 *
 * @param {object} supabase   — createServiceClient() instance
 * @param {object} signal     — signal payload
 * @param {string} signal.type          — flywheel_signals.signal_type CHECK value
 * @param {string} [signal.archetype]   — makeArchetypeHash() output
 * @param {string} [signal.company_domain]
 * @param {string} [signal.job_source]
 * @param {string} [signal.outcome]     — interview|offer|rejected|ghosted|no_response
 * @param {string} [signal.dismissed_reason]
 * @param {number} [signal.time_to_outcome_days]
 */
export async function recordSignal(supabase, signal) {
  try {
    await supabase.from('flywheel_signals').insert({
      signal_type: signal.type,
      profile_archetype_hash: signal.archetype || null,
      company_domain: signal.company_domain || null,
      job_source: signal.job_source || null,
      outcome: signal.outcome || null,
      dismissed_reason: signal.dismissed_reason || null,
      time_to_outcome_days: signal.time_to_outcome_days ?? null,
    });
  } catch (e) {
    console.warn('[flywheel/record]', e.message);
  }
}
