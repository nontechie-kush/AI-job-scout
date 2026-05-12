/**
 * GET /api/rolepitch/critique-preview?critique_id=xxx
 *
 * Returns the minimum data the /rolepitch/tailoring page needs to decide
 * whether to auto-fire the auto-tailor or to surface a 10s opt-out
 * (low-confidence inference) or a "want a JD?" prompt (no target at all).
 *
 * Auth: requires a logged-in user; the critique must be claimed to them.
 *
 * Returns: { target_context, inferred_target, candidate_name, has_resume }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabaseUser = await createClientFromRequest(request);
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const critiqueId = searchParams.get('critique_id');
    if (!critiqueId) return NextResponse.json({ error: 'critique_id required' }, { status: 400 });

    const service = createServiceClient();
    const { data: critique, error } = await service
      .from('rp_critiques')
      .select('id, user_id, name, target_context, inferred_target, parsed_resume, critique_json')
      .eq('id', critiqueId)
      .maybeSingle();

    if (error || !critique) return NextResponse.json({ error: 'Critique not found' }, { status: 404 });
    if (critique.user_id !== user.id) return NextResponse.json({ error: 'Not your critique' }, { status: 403 });

    return NextResponse.json({
      target_context: critique.target_context || null,
      inferred_target: critique.inferred_target || critique.critique_json?.inferred_target || null,
      candidate_name: critique.name || critique.parsed_resume?.name || null,
      has_resume: !!critique.parsed_resume,
    });
  } catch (err) {
    console.error('[rolepitch/critique-preview]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
