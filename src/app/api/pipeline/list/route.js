/**
 * GET /api/pipeline/list
 *
 * Returns the user's full pipeline (applications + outreach).
 * Used by the tracker page and dashboard for counts.
 *
 * Full pipeline CRUD (add / update / delete) comes in Phase 6.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('pipeline')
      .select('id, company, role_title, stage, type, applied_at, last_activity_at, notes')
      .eq('user_id', user.id)
      .order('last_activity_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    return NextResponse.json({ pipeline: data || [] });
  } catch (err) {
    console.error('[pipeline/list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
