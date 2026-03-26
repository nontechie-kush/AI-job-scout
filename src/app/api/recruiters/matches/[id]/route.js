/**
 * GET /api/recruiters/matches/[id]
 *
 * Returns a single recruiter match with joined recruiter data.
 * Used by mobile app's referral detail screen.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(_request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: match, error } = await supabase
      .from('recruiter_matches')
      .select(`
        id, relevance_score, status, match_reasons,
        outreach_draft, pilot_recommendation, outreach_channel, scheduled_at,
        recruiters!inner (
          id, name, title, current_company, type,
          specialization, geography, placements_at,
          response_rate, linkedin_url, email,
          follower_count
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!match) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Reshape to match what the mobile app expects
    const rec = match.recruiters;
    return NextResponse.json({
      match: {
        id: match.id,
        relevance_score: match.relevance_score,
        status: match.status,
        pilot_recommendation: match.pilot_recommendation,
        outreach_channel: match.outreach_channel,
        scheduled_at: match.scheduled_at,
        match_reasons: match.match_reasons,
        outreach_draft: match.outreach_draft,
        recruiter: {
          id: rec.id,
          full_name: rec.name,
          current_company: rec.current_company,
          title: rec.title,
          linkedin_handle: rec.linkedin_url
            ? rec.linkedin_url.replace(/.*linkedin\.com\/in\//, '').replace(/\/$/, '')
            : null,
          linkedin_url: rec.linkedin_url,
          classification: rec.type,
          email: rec.email,
          specialization: rec.specialization,
          response_rate: rec.response_rate,
        },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
