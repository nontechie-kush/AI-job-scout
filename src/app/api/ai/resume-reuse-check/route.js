/**
 * POST /api/ai/resume-reuse-check
 *
 * Body: { match_id: string }
 *
 * The cheap pre-check that runs FIRST in the v2 tailor pipeline. If a recent
 * tailoring already covers this role-cluster + the user's knowledge base
 * hasn't grown since, return the prior tailoring as a reuse candidate.
 *
 * No model call here — pure database logic. Cluster classification (one
 * Haiku call) happens via ensureJobCluster() and is cached on jobs.cluster_id.
 *
 * Response shapes:
 *   Reusable: {
 *     reusable: true,
 *     previous_tailored_resume_id: uuid,
 *     previous_job: { title, company, applied_at },
 *     diff_summary: string,
 *     cluster: { cluster_id, seniority_band }
 *   }
 *   Not reusable: {
 *     reusable: false,
 *     reason: 'no_prior_tailoring' | 'kb_changed' | 'expired' | 'pm_other_no_cache',
 *     cluster: { cluster_id, seniority_band }
 *   }
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ensureJobCluster } from '@/lib/ai/ensure-job-cluster';

const REUSE_TTL_DAYS = 14;

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id } = await request.json();
    if (!match_id) {
      return NextResponse.json({ error: 'match_id required' }, { status: 400 });
    }

    // Resolve match → job
    const { data: match } = await supabase
      .from('job_matches')
      .select('id, job_id, jobs ( id, title, company )')
      .eq('id', match_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!match?.jobs) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Classify the job (no-op if already cached on the row)
    const cluster = await ensureJobCluster(supabase, match.jobs.id);
    if (!cluster) {
      return NextResponse.json({ error: 'Cluster classification failed' }, { status: 500 });
    }

    // pm-other never participates in reuse — its briefs aren't cached
    if (cluster.cluster_id === 'pm-other') {
      return NextResponse.json({
        reusable: false,
        reason: 'pm_other_no_cache',
        cluster,
      });
    }

    // Current knowledge base version for this user
    const { data: profile } = await supabase
      .from('profiles')
      .select('knowledge_base_version')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const currentKbVersion = profile?.knowledge_base_version || 1;

    // Find the most recent v2 tailoring for this user in the same cluster + band.
    // Joining via story_brief_id → resume_story_briefs to filter by cluster.
    const cutoff = new Date(Date.now() - REUSE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates } = await supabase
      .from('tailored_resumes')
      .select(`
        id, created_at, story_brief_id, selected_atom_ids, match_id,
        resume_story_briefs!inner ( cluster_id, seniority_band, knowledge_base_version ),
        job_matches!inner ( jobs ( title, company ) )
      `)
      .eq('user_id', user.id)
      .eq('pipeline_version', 'v2')
      .gte('created_at', cutoff)
      .eq('resume_story_briefs.cluster_id', cluster.cluster_id)
      .eq('resume_story_briefs.seniority_band', cluster.seniority_band)
      .order('created_at', { ascending: false })
      .limit(1);

    const candidate = candidates?.[0];
    if (!candidate) {
      return NextResponse.json({
        reusable: false,
        reason: 'no_prior_tailoring',
        cluster,
      });
    }

    // KB version check — if user added atoms since last tailoring, story brief
    // is stale; force a fresh pass instead of reusing.
    if ((candidate.resume_story_briefs?.knowledge_base_version || 1) < currentKbVersion) {
      return NextResponse.json({
        reusable: false,
        reason: 'kb_changed',
        cluster,
      });
    }

    const prevJob = candidate.job_matches?.jobs;
    return NextResponse.json({
      reusable: true,
      previous_tailored_resume_id: candidate.id,
      previous_job: {
        title: prevJob?.title,
        company: prevJob?.company,
        applied_at: candidate.created_at,
      },
      diff_summary: `Already tailored for a ${cluster.cluster_id.replace('pm-', '')} role at ${cluster.seniority_band} level — same story beats apply here.`,
      cluster,
    });
  } catch (err) {
    console.error('[resume-reuse-check]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
