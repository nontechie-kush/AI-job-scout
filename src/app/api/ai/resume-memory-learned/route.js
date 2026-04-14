/**
 * GET /api/ai/resume-memory-learned?conversation_id=X
 *
 * Returns nuggets that were extracted from the given conversation.
 * Used by ResumeTailorSheet's ready stage to show the "Pilot just got
 * smarter — I learned N new things" card.
 *
 * Returns: { nuggets: [{nugget_type, company, role, fact, tags}] }
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
    const conversationId = searchParams.get('conversation_id');
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });
    }

    const { data: nuggets, error } = await supabase
      .from('user_experience_memory')
      .select('id, nugget_type, company, role, fact, tags, extracted_at')
      .eq('user_id', user.id)
      .eq('source_conversation_id', conversationId)
      .order('extracted_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ nuggets: nuggets || [] });
  } catch (err) {
    console.error('[resume-memory-learned]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
