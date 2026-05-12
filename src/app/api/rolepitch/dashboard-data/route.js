/**
 * GET /api/rolepitch/dashboard-data
 *
 * Single-shot dashboard load: returns resumes + critiques + credits in one
 * round-trip with one auth check. Replaces 3 sequential fetches (my-resumes,
 * my-critiques, credits) that each independently re-authenticated.
 *
 * Returns:
 *   { resumes, critiques, pitch_credits, plan_tier }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceClient();

    // One auth check — 3 parallel DB queries
    const resumesQuery = () => service
      .from('tailored_resumes')
      .select('id, jd_id, created_at, resume_strength, selected_atom_ids, tailored_version, edited_version, edited_at, pipeline_version')
      .eq('user_id', user.id)
      .not('jd_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const legacyResumesQuery = () => service
      .from('tailored_resumes')
      .select('id, jd_id, created_at, resume_strength, selected_atom_ids, tailored_version, pipeline_version')
      .eq('user_id', user.id)
      .not('jd_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    // One auth check — 3 parallel DB queries
    let [resumesResult, critiquesResult, userResult] = await Promise.all([
      resumesQuery(),
      service
        .from('rp_critiques')
        .select('id, name, target_context, critique_json, created_at, expires_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),

      service
        .from('users')
        .select('pitch_credits, plan_tier')
        .eq('id', user.id)
        .single(),
    ]);

    if (resumesResult.error?.message?.includes('edited_version') || resumesResult.error?.message?.includes('edited_at')) {
      resumesResult = await legacyResumesQuery();
    }

    const resumes = resumesResult.data || [];
    const critiques = critiquesResult.data || [];
    const pitchCredits = userResult.data?.pitch_credits ?? 5;
    const planTier = userResult.data?.plan_tier ?? 'free';

    let shapedResumes = [];
    if (resumes.length > 0) {
      const jdIds = [...new Set(resumes.map(r => r.jd_id).filter(Boolean))];
      const needsAtomCount = resumes.some(
        r => r.pipeline_version !== 'rolepitch-v1' && r.pipeline_version !== 'rolepitch-draft-v1'
      );

      // JD titles + atom count in parallel
      const [jdsResult, atomResult] = await Promise.all([
        service.from('job_descriptions').select('id, title, company').in('id', jdIds),
        needsAtomCount
          ? service
              .from('user_experience_memory')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('confidence', 0.5)
          : Promise.resolve({ count: 0 }),
      ]);

      const jdMap = new Map((jdsResult.data || []).map(j => [j.id, j]));
      const totalAtomsCount = atomResult.count || 0;

      shapedResumes = resumes.map(r => {
        const jd = jdMap.get(r.jd_id) || {};
        const effectiveVersion = r.edited_version || r.tailored_version || {};
        const exp = effectiveVersion.experience || [];
        const bulletsRewritten = exp.reduce((n, role) => n + (role.bullets || []).length, 0);

        let beforeScore, afterScore, highlightsUsed;
        if (r.pipeline_version === 'rolepitch-v1' || r.pipeline_version === 'rolepitch-draft-v1') {
          beforeScore = effectiveVersion.before_score || r.tailored_version?.before_score || 55;
          afterScore = effectiveVersion.after_score || r.tailored_version?.after_score || Math.min(beforeScore + 18, 90);
          highlightsUsed = bulletsRewritten;
        } else {
          beforeScore = r.resume_strength || 63;
          const usageRatio = totalAtomsCount > 0
            ? Math.min((r.selected_atom_ids || []).length / totalAtomsCount, 1)
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
          has_edits: !!r.edited_version,
          edited_at: r.edited_at,
        };
      });
    }

    return NextResponse.json({
      resumes: shapedResumes,
      critiques,
      pitch_credits: pitchCredits,
      plan_tier: planTier,
    });
  } catch (err) {
    console.error('[rolepitch/dashboard-data]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
