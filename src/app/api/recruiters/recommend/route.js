/**
 * GET /api/recruiters/recommend
 *
 * Returns daily capsule: top 3 uncontacted recruiter matches enriched with
 * Pilot's recommendation (why this person, why now) + optimal send time.
 *
 * Optional: ?job_id=uuid — job-triggered mode, surfaces recruiters at that company.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Optimal send time ─────────────────────────────────────────────────────────
// Best: Tue/Wed/Thu 9am in recruiter's local timezone

const US_GEOS = new Set(['us', 'usa', 'united states', 'canada', 'north america']);

function getOptimalSendTime(geography = []) {
  const geo = geography.map(g => g.toLowerCase());
  const isUS = geo.some(g => US_GEOS.has(g));
  // Default to IST — most recruiters in our DB are India-based.
  // Only use EST if geography explicitly flags US/Canada.
  // 9am IST = 03:30 UTC | 9am EST = 14:00 UTC
  const utcH = isUS ? 14 : 3;
  const utcM = isUS ? 0 : 30;

  const now = new Date();
  const dow = now.getDay();
  const goodDays = [2, 3, 4]; // Tue Wed Thu

  // Check if we've already passed 9am in the recruiter's timezone today
  const pastCutoff = now.getUTCHours() > utcH || (now.getUTCHours() === utcH && now.getUTCMinutes() >= utcM);

  let daysAhead = 0;
  if (!goodDays.includes(dow) || pastCutoff) {
    do { daysAhead++; } while (!goodDays.includes((dow + daysAhead) % 7));
  }

  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + daysAhead);
  // Remind 10 minutes before 9am so user has time to open LinkedIn
  target.setUTCHours(utcH, utcM - 10, 0, 0);

  return target;
}

function formatSendTime(date) {
  const day = DAY[date.getDay()];
  return `${day} ~9am`;
}

// ── Channel recommendation ────────────────────────────────────────────────────

function recommendChannel(recruiter) {
  if (recruiter.email) return 'email';
  return 'linkedin';
}

// ── Pilot recommendation text (rule-based, no Claude cost) ───────────────────

function buildPilotRec(recruiter, channel, sendTime) {
  const parts = [];
  const placements = (recruiter.placements_at || []).slice(0, 2);
  const rate = recruiter.response_rate;
  const company = recruiter.current_company || '';
  const day = DAY[sendTime.getDay()];

  if (placements.length >= 2) {
    parts.push(`Placed at ${placements.join(' and ')}`);
  } else if (placements.length === 1) {
    parts.push(`Has placed at ${placements[0]}`);
  }

  if (rate >= 70) {
    parts.push(`${rate}% reply rate — responds more than most`);
  } else if (rate >= 50) {
    parts.push(`Decent ${rate}% reply rate`);
  }

  if (recruiter.type === 'agency') {
    parts.push(`Agency recruiter — finding candidates is their job, they want your message`);
  } else if (company) {
    parts.push(`Internal TA at ${company} — direct line to the hiring team`);
  }

  if (channel === 'email') {
    parts.push(`Email cuts through LinkedIn noise for this one`);
  } else {
    parts.push(`LinkedIn DM is the right move here, not cold email`);
  }

  return parts.join('. ') + '.';
}

// ── Should Pilot recommend outreach for this company/role? ────────────────────

function pilotShouldRecommend(recruiter, job) {
  if (!job) return true; // daily capsule — always recommend
  // Job-triggered: recommend if recruiter placed at or works at job's company
  const domain = (job.company_domain || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const recCompany = (recruiter.current_company || '').toLowerCase();
  const placements = (recruiter.placements_at || []).map(p => p.toLowerCase());

  return (
    recCompany.includes(company) ||
    company.includes(recCompany) ||
    placements.some(p => p.includes(company) || company.includes(p)) ||
    (domain && (recCompany.includes(domain) || placements.some(p => p.includes(domain))))
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');

    // Fetch job context if job-triggered
    let job = null;
    if (jobId) {
      const { data: match } = await supabase
        .from('job_matches')
        .select('jobs(title, company, company_domain, apply_type)')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle();
      job = match?.jobs || null;
    }

    // Fetch top uncontacted recruiter matches (pending, no scheduled_at yet)
    const { data: matches } = await supabase
      .from('recruiter_matches')
      .select(`
        id, relevance_score, match_reasons, outreach_draft,
        recruiters!inner (
          id, name, title, current_company, type,
          specialization, geography, placements_at,
          response_rate, avg_reply_days, linkedin_url, email,
          follower_count
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .is('scheduled_at', null)
      .order('relevance_score', { ascending: false })
      .limit(jobId ? 20 : 3); // wider pool for job-triggered filtering

    if (!matches?.length) return NextResponse.json({ capsule: [] });

    // Filter for job-triggered mode
    const pool = jobId
      ? matches.filter(m => pilotShouldRecommend(m.recruiters, job)).slice(0, 3)
      : matches;

    const capsule = pool.map(m => {
      const rec = m.recruiters;
      const channel = recommendChannel(rec);
      const sendTime = getOptimalSendTime(rec.geography || []);

      return {
        match_id: m.id,
        recruiter: {
          id: rec.id,
          name: rec.name,
          title: rec.title,
          company: rec.current_company,
          linkedin_url: rec.linkedin_url,
          email: rec.email,
          follower_count: rec.follower_count,
          placements_at: rec.placements_at,
          response_rate: rec.response_rate,
          type: rec.type,
          geography: rec.geography,
        },
        relevance_score: m.relevance_score,
        match_reasons: m.match_reasons,
        channel,                              // 'linkedin' | 'email'
        send_time: sendTime.toISOString(),    // ISO — frontend formats
        send_time_label: formatSendTime(sendTime), // "Tuesday 9am"
        pilot_recommendation: buildPilotRec(rec, channel, sendTime),
        job_context: job ? { title: job.title, company: job.company } : null,
      };
    });

    return NextResponse.json({ capsule });
  } catch (err) {
    console.error('[recruiters/recommend]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
