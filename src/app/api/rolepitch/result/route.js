/**
 * GET /api/rolepitch/result?tailored_resume_id=xxx
 *
 * Returns the full tailored result for Step 5 (Result) and Step 7 (Final Output)
 * of the RolePitch onboarding flow.
 *
 * Derives:
 *   - before_score / after_score  (from resume_strength or atom validation stats)
 *   - gap_questions               (from selection_dropped — atoms that were dropped)
 *   - bullets_by_role             (before = base_version bullets, after = tailored_version bullets)
 *   - stats                       (achievements used, bullets rewritten, layout preserved)
 *
 * Returns:
 *   {
 *     tailored_resume_id,
 *     jd: { title, company },
 *     before_score: number,
 *     after_score: number,
 *     bullets_by_role: [
 *       { company, role, before: string[], after: string[] }
 *     ],
 *     gap_questions: [
 *       { atom_id, question, tip }
 *     ],
 *     stats: {
 *       achievements_used: number,
 *       total_achievements: number,
 *       bullets_rewritten: number,
 *       layout_preserved: boolean,
 *     }
 *   }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Map a dropped atom reason → a user-friendly gap question
function reasonToQuestion(reason, fact) {
  const r = (reason || '').toLowerCase();
  if (r.includes('enterprise') || r.includes('b2b')) {
    return { question: 'Do you have experience working directly with enterprise or B2B customers?', tip: 'e.g. customer calls, QBRs, pilots, contracts' };
  }
  if (r.includes('payment') || r.includes('fintech') || r.includes('financial')) {
    return { question: 'Have you worked on payment systems or financial infrastructure?', tip: 'e.g. routing, fraud, settlement, compliance' };
  }
  if (r.includes('0→1') || r.includes('launch') || r.includes('zero')) {
    return { question: 'Have you led a product through a 0→1 launch at scale?', tip: 'More than 10K users at launch' };
  }
  if (r.includes('data') || r.includes('analytics') || r.includes('ml')) {
    return { question: 'Have you built or owned data/ML-powered features?', tip: 'e.g. recommendations, fraud detection, analytics dashboards' };
  }
  if (r.includes('team') || r.includes('lead') || r.includes('manag')) {
    return { question: 'Have you directly managed or mentored a team?', tip: 'e.g. reports, interns, cross-functional pods' };
  }
  // Fallback: surface the dropped fact as a question
  const shortFact = fact ? fact.slice(0, 80) : 'this experience';
  return {
    question: `Can you tell us more about: "${shortFact}"?`,
    tip: 'Any additional context helps improve your score',
  };
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tailoredResumeId = searchParams.get('tailored_resume_id');
    if (!tailoredResumeId) {
      return NextResponse.json({ error: 'tailored_resume_id required' }, { status: 400 });
    }

    // ── Load tailored resume ──────────────────────────────────────────
    const { data: tr, error: trErr } = await supabase
      .from('tailored_resumes')
      .select('id, user_id, jd_id, match_id, base_version, tailored_version, selected_atom_ids, resume_strength, pipeline_version')
      .eq('id', tailoredResumeId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (trErr || !tr) {
      return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });
    }

    // ── Load JD (from job_descriptions or job_matches) ────────────────
    let jdTitle = '', jdCompany = '';
    if (tr.jd_id) {
      const { data: jd } = await supabase
        .from('job_descriptions')
        .select('title, company')
        .eq('id', tr.jd_id)
        .maybeSingle();
      jdTitle = jd?.title || '';
      jdCompany = jd?.company || '';
    } else if (tr.match_id) {
      const { data: match } = await supabase
        .from('job_matches')
        .select('jobs ( title, company )')
        .eq('id', tr.match_id)
        .maybeSingle();
      jdTitle = match?.jobs?.title || '';
      jdCompany = match?.jobs?.company || '';
    }

    // ── Build bullets_by_role diff ────────────────────────────────────
    const base = tr.base_version?.experience || [];
    const tailored = tr.tailored_version?.experience || [];

    const bulletsByRole = base.map((baseRole) => {
      const tailoredRole = tailored.find(
        (t) =>
          (t.company || '').toLowerCase() === (baseRole.company || '').toLowerCase() &&
          (t.title || '').toLowerCase() === (baseRole.title || '').toLowerCase(),
      );
      return {
        company: baseRole.company,
        role: baseRole.title,
        before: (baseRole.bullets || []).map((b) => b.text),
        after: tailoredRole ? (tailoredRole.bullets || []).map((b) => b.text) : (baseRole.bullets || []).map((b) => b.text),
      };
    });

    const bulletsRewritten = bulletsByRole.reduce((sum, role) => {
      return sum + role.after.filter((a, i) => a !== role.before[i]).length;
    }, 0);

    // ── Stats ─────────────────────────────────────────────────────────
    const totalAtoms = await supabase
      .from('user_experience_memory')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('confidence', 0.5);

    const stats = {
      achievements_used: (tr.selected_atom_ids || []).length,
      total_achievements: totalAtoms.count || 0,
      bullets_rewritten: bulletsRewritten,
      layout_preserved: true,
    };

    // ── Score calculation ─────────────────────────────────────────────
    let beforeScore, afterScore;
    if (tr.pipeline_version === 'rolepitch-v1') {
      // RolePitch stores scores inside tailored_version JSON
      beforeScore = tr.tailored_version?.before_score || tr.resume_strength || 63;
      afterScore = tr.tailored_version?.after_score || beforeScore;
    } else {
      beforeScore = tr.resume_strength || 63;
      const usageRatio = stats.total_achievements > 0
        ? Math.min(stats.achievements_used / stats.total_achievements, 1)
        : 0.5;
      afterScore = Math.min(Math.round(beforeScore + (30 * usageRatio)), 84);
    }

    // ── Gap questions (from dropped atoms, max 3) ─────────────────────
    // Dropped atoms are stored in tailored_version metadata if present,
    // otherwise we surface generic gap questions based on the JD title.
    const droppedMeta = tr.tailored_version?._selection_dropped || [];
    const gapQuestions = droppedMeta.slice(0, 3).map((d) => ({
      atom_id: d.id,
      ...reasonToQuestion(d.reason, d.fact),
    }));

    // If no dropped metadata, generate contextual defaults from JD
    if (!gapQuestions.length) {
      const defaults = [
        { question: 'Do you have experience working directly with enterprise or B2B customers?', tip: 'e.g. customer calls, QBRs, pilots' },
        { question: 'Have you worked on payment systems or financial infrastructure?', tip: 'e.g. routing, fraud, settlement' },
        { question: 'Have you led a product through a 0→1 launch at scale?', tip: 'More than 10K users at launch' },
      ];
      gapQuestions.push(...defaults);
    }

    return NextResponse.json({
      tailored_resume_id: tr.id,
      jd: { title: jdTitle, company: jdCompany },
      before_score: beforeScore,
      after_score: afterScore,
      bullets_by_role: bulletsByRole,
      gap_questions: gapQuestions,
      stats,
    });

  } catch (err) {
    console.error('[rolepitch/result]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
