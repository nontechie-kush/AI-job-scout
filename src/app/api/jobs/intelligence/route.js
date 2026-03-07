/**
 * GET /api/jobs/intelligence?domain={company_domain}
 *
 * Returns company intelligence data for a given domain.
 * Used by job detail page to show Pilot culture read + ratings.
 *
 * Returns null data (not 404) when no intelligence exists yet —
 * the UI shows a "Pilot is learning about this company" placeholder.
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

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain) return NextResponse.json({ error: 'domain param required' }, { status: 400 });

    const { data, error } = await supabase
      .from('job_intelligence')
      .select(
        `company_domain,
         glassdoor_rating,
         glassdoor_recommend_pct,
         glassdoor_wlb_score,
         glassdoor_culture_score,
         ambitionbox_rating,
         ambitionbox_wlb_score,
         ambitionbox_growth_score,
         ambitionbox_recommend_pct,
         culture_summary,
         top_positives,
         top_warnings,
         interview_process,
         common_complaints,
         hiring_velocity_30d,
         refreshed_at`,
      )
      .eq('company_domain', domain)
      .maybeSingle();

    if (error) throw error;

    // Return null intelligence gracefully (UI handles this)
    return NextResponse.json({ intelligence: data || null });
  } catch (err) {
    console.error('[jobs/intelligence]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
