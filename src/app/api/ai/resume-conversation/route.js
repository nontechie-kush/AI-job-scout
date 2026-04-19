/**
 * GET /api/ai/resume-conversation?tailored_resume_id=...
 *
 * Returns the most recent conversation for a tailored resume so the chat UI
 * can rehydrate after the user backs out, accidentally closes the sheet, or
 * comes back later.
 *
 * Returns: { conversation_id, messages, accepted_change_ids } | { conversation_id: null }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tailoredResumeId = searchParams.get('tailored_resume_id');
    if (!tailoredResumeId) {
      return NextResponse.json({ error: 'tailored_resume_id required' }, { status: 400 });
    }

    const [{ data: conversation }, { data: tailored }] = await Promise.all([
      supabase
        .from('resume_conversations')
        .select('id, messages, updated_at')
        .eq('tailored_resume_id', tailoredResumeId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('tailored_resumes')
        .select('id, changes, tailored_version')
        .eq('id', tailoredResumeId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    // changes is sometimes an array (apply-changes log) and sometimes the
    // gap-analysis object — only treat arrays as accepted-change history.
    const acceptedChanges = Array.isArray(tailored?.changes) ? tailored.changes : [];
    const acceptedChangeIds = acceptedChanges.map((c) => c.id).filter(Boolean);

    return NextResponse.json({
      conversation_id: conversation?.id || null,
      messages: conversation?.messages || [],
      accepted_change_ids: acceptedChangeIds,
      accepted_changes: acceptedChanges,
      tailored_version: tailored?.tailored_version || null,
    });
  } catch (err) {
    console.error('[resume-conversation]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
