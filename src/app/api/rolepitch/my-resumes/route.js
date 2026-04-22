/**
 * GET /api/rolepitch/my-resumes
 *
 * Returns all tailored resumes for the logged-in user that were created
 * via the RolePitch flow (i.e. have a jd_id), newest first.
 *
 * Returns:
 *   { resumes: [{ id, jd: { title, company }, created_at, before_score, after_score, stats }] }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: resumes, error } = await supabase
      .from('tailored_resumes')
      .select('id, jd_id, created_at, resume_strength, selected_atom_ids, tailored_version, pipeline_version')
      .eq('user_id', user.id)
      .not('jd_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!resumes?.length) return NextResponse.json({ resumes: [] });

    // Load JD titles in one query
    const jdIds = [...new Set(resumes.map(r => r.jd_id).filter(Boolean))];
    const { data: jds } = await supabase
      .from('job_descriptions')
      .select('id, title, company')
      .in('id', jdIds);

    const jdMap = new Map((jds || []).map(j => [j.id, j]));

    const totalAtoms = await supabase
      .from('user_experience_memory')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('confidence', 0.5);

    const result = resumes.map(r => {
      const jd = jdMap.get(r.jd_id) || {};
      const exp = r.tailored_version?.experience || [];
      const bulletsRewritten = exp.reduce((n, role) => n + (role.bullets || []).length, 0);

      // rolepitch-v1 rows store real scores inside tailored_version
      let beforeScore, afterScore, highlightsUsed;
      if (r.pipeline_version === 'rolepitch-v1') {
        beforeScore = r.tailored_version?.before_score || 55;
        afterScore = r.tailored_version?.after_score || Math.min(beforeScore + 18, 90);
        highlightsUsed = bulletsRewritten;
      } else {
        beforeScore = r.resume_strength || 63;
        const usageRatio = (totalAtoms.count || 0) > 0
          ? Math.min((r.selected_atom_ids || []).length / totalAtoms.count, 1)
          : 0.5;
        afterScore = Math.min(Math.round(beforeScore + 30 * usageRatio), 84);
        highlightsUsed = (r.selected_atom_ids || []).length;
      }

      return {
        id: r.id,
        jd: { title: jd.title || 'Untitled role', company: jd.company || '' },
        created_at: r.created_at,
        before_score: beforeScore,
        after_score: afterScore,
        highlights_used: highlightsUsed,
        bullets_rewritten: bulletsRewritten,
      };
    });

    return NextResponse.json({ resumes: result });
  } catch (err) {
    console.error('[rolepitch/my-resumes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
