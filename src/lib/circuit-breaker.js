/**
 * Circuit breaker for job scrapers.
 * State is persisted in Supabase scraper_status table.
 *
 * States:
 *   closed    — running normally
 *   open      — failing, skip for OPEN_TIMEOUT_MS (1 hour)
 *   half_open — timeout elapsed, allow one attempt
 *
 * Schema columns: source, state, failure_count, last_success, last_failure, opened_at
 */

import { createServiceClient } from '@/lib/supabase/server';

const FAILURE_THRESHOLD = 3;
const OPEN_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export async function withCircuitBreaker(source, fn) {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from('scraper_status')
    .select('*')
    .eq('source', source)
    .single();

  if (!row) {
    // Unknown source — run without circuit breaking, insert status row
    await supabase.from('scraper_status').insert({ source, state: 'closed' }).select().maybeSingle();
    return runFn(supabase, source, fn, { failure_count: 0, state: 'closed' });
  }

  if (row.state === 'open') {
    const elapsed = Date.now() - new Date(row.last_failure || row.opened_at || 0).getTime();
    if (elapsed < OPEN_TIMEOUT_MS) {
      console.log(`[cb] ${source}: OPEN — skipping (${Math.round(elapsed / 60000)}m elapsed)`);
      return { skipped: true, reason: 'circuit_open', source };
    }
    // Timeout elapsed — promote to half_open for one retry
    await supabase.from('scraper_status').update({ state: 'half_open' }).eq('source', source);
    row.state = 'half_open';
  }

  return runFn(supabase, source, fn, row);
}

async function runFn(supabase, source, fn, row) {
  try {
    const result = await fn();
    await supabase
      .from('scraper_status')
      .update({
        state: 'closed',
        failure_count: 0,
        last_success: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('source', source);
    return result;
  } catch (err) {
    const newCount = (row.failure_count || 0) + 1;
    const newState = newCount >= FAILURE_THRESHOLD ? 'open' : row.state;
    await supabase
      .from('scraper_status')
      .update({
        state: newState,
        failure_count: newCount,
        last_failure: new Date().toISOString(),
        opened_at: newState === 'open' ? new Date().toISOString() : row.opened_at,
        updated_at: new Date().toISOString(),
      })
      .eq('source', source);

    console.error(`[cb] ${source}: failure ${newCount}/${FAILURE_THRESHOLD} — ${err.message}`);
    return { error: err.message, source, failures: newCount };
  }
}
