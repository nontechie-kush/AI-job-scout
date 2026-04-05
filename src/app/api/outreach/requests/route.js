/**
 * GET /api/outreach/requests
 *
 * Founder/admin endpoint — returns all automation request logs.
 * Protected by CRON_SECRET (same as cron routes).
 *
 * Query params:
 *   ?limit=50       — max rows (default 50, max 200)
 *   ?offset=0       — pagination offset
 *   ?user_id=xxx    — filter by user
 *   ?source=mobile  — filter by source (mobile | extension)
 *   ?status=completed — filter by request status
 *
 * Returns: { requests: [...], total: number }
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Auth: same CRON_SECRET pattern as cron routes
    const authHeader = request.headers.get('authorization') || '';
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const userId = searchParams.get('user_id');
    const source = searchParams.get('source');
    const status = searchParams.get('status');

    const supabase = createServiceClient();

    let query = supabase
      .from('automation_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq('user_id', userId);
    if (source) query = query.eq('source', source);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ requests: data || [], total: count || 0 });
  } catch (err) {
    console.error('[outreach/requests]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
