/**
 * POST /api/ai/resume-atomize
 *
 * Body: { profile_id?: string, force?: boolean }
 *
 * Manual / backfill entrypoint for atomization. The upload flows
 * (parse-profile, resume-structure) auto-fire atomization via the
 * shared `atomizeResume()` helper after structuring completes.
 *
 * Use this route to:
 *   - Backfill atoms for a profile that was structured before v2 shipped
 *   - Force re-atomize after editing the structured_resume manually
 *
 * Idempotent: skips if atoms already exist for this profile unless force=true.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { atomizeResume } from '@/lib/ai/atomize-resume';

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { profile_id, force = false } = body;

    let profileQuery = supabase
      .from('profiles')
      .select('id, structured_resume, knowledge_base_version')
      .eq('user_id', user.id);

    if (profile_id) {
      profileQuery = profileQuery.eq('id', profile_id);
    } else {
      profileQuery = profileQuery.order('parsed_at', { ascending: false });
    }

    const { data: profile } = await profileQuery.limit(1).maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 });
    }
    if (!profile.structured_resume) {
      return NextResponse.json(
        { error: 'Profile has no structured_resume. Run /api/ai/resume-structure first.' },
        { status: 400 },
      );
    }

    const result = await atomizeResume({
      supabase,
      userId: user.id,
      profile,
      force,
    });

    return NextResponse.json({ profile_id: profile.id, ...result });
  } catch (err) {
    console.error('[resume-atomize]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
