/**
 * Hirist.tech scraper — DISABLED (March 2026)
 *
 * __NEXT_DATA__ initialState.job.jobfeed is always empty (0 jobs) in SSR.
 * Their public API at api.hirist.tech returns 401 (requires partner auth).
 * Re-enable when Hirist provides a public API or their SSR data is restored.
 */

import { stripHtml, detectRemote, makeDescHash, parseSalary } from './index';

export async function scrapeHirist() {
  console.warn('[hirist] scraper disabled — returns 0 jobs until API access is resolved');
  return [];
}
