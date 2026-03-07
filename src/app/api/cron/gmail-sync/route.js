/**
 * GET /api/cron/gmail-sync
 *
 * Vercel Cron — runs every hour.
 * Syncs Gmail for all users who have connected their account.
 *
 * Strategy:
 *   - Get users with gmail_tokens (most-recently-synced last)
 *   - Process up to MAX_USERS_PER_RUN
 *   - Fire syncUserGmail for each
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { syncUserGmail } from '@/app/api/gmail/sync/route';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_USERS_PER_RUN = 20;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();

  // Get users with Gmail connected, least-recently-synced first
  const { data: tokens } = await supabase
    .from('gmail_tokens')
    .select('user_id, last_synced_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(MAX_USERS_PER_RUN);

  if (!tokens?.length) {
    return NextResponse.json({
      message: 'No Gmail-connected users',
      duration_ms: Date.now() - startedAt,
    });
  }

  const results = {};

  for (const token of tokens) {
    try {
      results[token.user_id] = await syncUserGmail(token.user_id);
    } catch (err) {
      console.error(`[cron/gmail-sync] user ${token.user_id}:`, err.message);
      results[token.user_id] = { error: err.message };
    }
  }

  const totalNew = Object.values(results).reduce((s, r) => s + (r.new_entries || 0), 0);
  const totalUpdated = Object.values(results).reduce((s, r) => s + (r.updated_entries || 0), 0);

  console.log(`[cron/gmail-sync] done — ${totalNew} new, ${totalUpdated} updated in ${Date.now() - startedAt}ms`);

  return NextResponse.json({
    duration_ms: Date.now() - startedAt,
    users_processed: tokens.length,
    total_new: totalNew,
    total_updated: totalUpdated,
    results,
  });
}
