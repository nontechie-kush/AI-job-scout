/**
 * Helpers for mirroring anonymous tailor flow state into the rp_drafts table.
 *
 * Routes accept an optional `draft_id` in their body/formData; if present,
 * they call mirrorToDraft() with the relevant patch as a side effect after
 * their primary work succeeds. Failures are logged but never fail the route —
 * mirror is additive, not load-bearing (the route still returns its result
 * inline so the legacy localStorage flow keeps working).
 */

import { createServiceClient } from '@/lib/supabase/service-client';

/**
 * Update an unclaimed, unexpired draft. Returns true on success, false on any
 * failure (logged but non-fatal).
 *
 * @param {string} draftId
 * @param {object} patch — already-validated subset of allowed fields
 * @param {string} ridForLog — caller's request id, for log correlation
 */
export async function mirrorToDraft(draftId, patch, ridForLog) {
  if (!draftId) return false;
  if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) return false;
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from('rp_drafts')
      .update(patch)
      .eq('id', draftId)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle();
    if (error) {
      console.error(`[mirrorToDraft] MIRROR FAILED — result may be lost rid=${ridForLog} draft=${draftId}`, {
        message: error.message, code: error.code, fields: Object.keys(patch),
      });
      return false;
    }
    if (!data) {
      console.error(`[mirrorToDraft] MIRROR FAILED — draft expired or missing (0 rows updated) rid=${ridForLog} draft=${draftId}`, {
        fields: Object.keys(patch),
      });
      return false;
    }
    console.log(`[mirrorToDraft] updated rid=${ridForLog} draft=${draftId}`, { fields: Object.keys(patch) });
    return true;
  } catch (e) {
    console.error(`[mirrorToDraft] MIRROR FAILED — threw rid=${ridForLog} draft=${draftId}`, { message: e?.message });
    return false;
  }
}
