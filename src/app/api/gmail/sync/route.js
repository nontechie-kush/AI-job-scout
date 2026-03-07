/**
 * POST /api/gmail/sync
 *
 * Syncs job-related Gmail threads for the authenticated user.
 * Called manually from the tracker page or by the hourly cron.
 *
 * Privacy: subject lines are used for detection only — never stored.
 * We store: gmail_thread_id, sender_domain (derived), detected_pattern only.
 *
 * Returns: { new_entries, updated_entries, errors }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { refreshAccessToken, getJobThreads, getThreadMetadata } from '@/lib/gmail/client';
import { detectPattern, patternToStage, isStageProgression } from '@/lib/gmail/patterns';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await syncUserGmail(user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[gmail/sync]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Core sync logic — also called from the cron route.
 * Uses service client throughout (gmail_tokens has no user RLS).
 */
export async function syncUserGmail(userId) {
  const supabase = createServiceClient();

  // 1. Get tokens
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('gmail_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single();

  if (tokenErr || !tokenRow) {
    return { skipped: 'no_tokens' };
  }

  // 2. Refresh access token if expired (or within 5 minutes of expiry)
  let accessToken = tokenRow.access_token;
  const expiryBuffer = 5 * 60 * 1000; // 5 min
  if (new Date(tokenRow.token_expiry).getTime() - Date.now() < expiryBuffer) {
    try {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from('gmail_tokens')
        .update({ access_token: accessToken, token_expiry: newExpiry })
        .eq('user_id', userId);
    } catch (err) {
      console.error(`[gmail/sync] Token refresh failed for ${userId}:`, err.message);
      return { error: 'token_refresh_failed' };
    }
  }

  // 3. Get existing pipeline thread IDs for this user
  const { data: existingPipeline } = await supabase
    .from('pipeline')
    .select('id, gmail_thread_id, stage, company')
    .eq('user_id', userId)
    .not('gmail_thread_id', 'is', null);

  const threadMap = new Map((existingPipeline || []).map((p) => [p.gmail_thread_id, p]));

  // 4. Fetch recent ATS threads from Gmail
  let threads;
  try {
    threads = await getJobThreads(accessToken);
  } catch (err) {
    console.error(`[gmail/sync] getJobThreads failed for ${userId}:`, err.message);
    return { error: 'gmail_api_failed' };
  }

  let newEntries = 0;
  let updatedEntries = 0;
  let errors = 0;

  for (const thread of threads) {
    try {
      const meta = await getThreadMetadata(accessToken, thread.id);
      if (!meta) continue;

      const pattern = detectPattern(meta.senderDomain, meta.subject, meta.messageCount);
      const stage = patternToStage(pattern);

      const existing = threadMap.get(thread.id);

      if (existing) {
        // Thread already tracked — update stage if progressed
        if (stage && isStageProgression(existing.stage, stage)) {
          await supabase
            .from('pipeline')
            .update({ stage, last_activity_at: new Date().toISOString() })
            .eq('id', existing.id)
            .eq('user_id', userId);
          updatedEntries++;
        }
      } else {
        // New thread — create pipeline entry
        if (!pattern) continue; // Don't create entry if we can't identify it

        // Try to get company from a domain that isn't the ATS itself
        const company = meta.senderDomain
          .replace(/^(jobs\.|careers\.|mail\.)/, '')
          .split('.')[0] || 'Unknown Company';

        const pipelineStage = stage || 'applied';

        await supabase.from('pipeline').insert({
          user_id: userId,
          type: 'application',
          stage: pipelineStage,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          company_logo_char: company[0].toUpperCase(),
          gmail_thread_id: thread.id,
          source: 'gmail',
          applied_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        });
        newEntries++;
      }
    } catch (err) {
      console.error(`[gmail/sync] thread ${thread.id} error:`, err.message);
      errors++;
    }
  }

  // 5. Update last_synced_at
  await supabase
    .from('gmail_tokens')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { new_entries: newEntries, updated_entries: updatedEntries, errors };
}
