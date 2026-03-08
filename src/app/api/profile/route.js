/**
 * GET  /api/profile   — full profile data for the settings page
 * PATCH /api/profile  — update user preferences (pilot_mode, cadence, job prefs)
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user row + profile + stats in parallel
    const [
      { data: userRow },
      { data: profile },
      { count: appliedCount },
      { count: messagedCount },
      { count: pipelineCount },
    ] = await Promise.all([
      supabase.from('users')
        .select('name, email, pilot_mode, notif_cadence, notif_push, target_roles, locations, remote_pref, salary_min, salary_max, salary_currency, ic_or_lead, company_stage, created_at, streak_count, search_day_count')
        .eq('id', user.id)
        .maybeSingle(),

      supabase.from('profiles')
        .select('parsed_json, parsed_at, source, job_search_titles')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase.from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'applied'),

      supabase.from('recruiter_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['messaged', 'replied', 'placed']),

      supabase.from('pipeline')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    // Gmail status — needs service client (no user RLS on gmail_tokens)
    const serviceClient = createServiceClient();
    const { data: gmailToken } = await serviceClient
      .from('gmail_tokens')
      .select('last_synced_at')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      user: userRow || {},
      profile: profile
        ? {
            seniority: profile.parsed_json?.seniority || null,
            skills: (profile.parsed_json?.skills || []).slice(0, 8),
            years_exp: profile.parsed_json?.years_exp || null,
            companies: (profile.parsed_json?.companies || []).slice(0, 3),
            strongest_card: profile.parsed_json?.strongest_card || null,
            parsed_at: profile.parsed_at,
            source: profile.source,
            job_search_titles: profile.job_search_titles || null,
          }
        : null,
      gmail: {
        connected: !!gmailToken,
        last_synced_at: gmailToken?.last_synced_at || null,
      },
      stats: {
        applied: appliedCount || 0,
        messaged: messagedCount || 0,
        pipeline: pipelineCount || 0,
      },
    });
  } catch (err) {
    console.error('[profile GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────
const VALID_PILOT_MODES = new Set(['steady', 'coach', 'hype', 'unfiltered']);
const VALID_CADENCES = new Set(['every_4h', 'daily', 'urgent_only', 'manual']);
const VALID_REMOTE_PREFS = new Set(['remote_only', 'hybrid', 'onsite_ok', 'open']);
const VALID_IC_LEAD = new Set(['ic', 'lead', 'either']);

export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const update = {};

    if (body.pilot_mode !== undefined) {
      if (!VALID_PILOT_MODES.has(body.pilot_mode)) {
        return NextResponse.json({ error: 'Invalid pilot_mode' }, { status: 400 });
      }
      update.pilot_mode = body.pilot_mode;
    }

    if (body.notif_cadence !== undefined) {
      if (!VALID_CADENCES.has(body.notif_cadence)) {
        return NextResponse.json({ error: 'Invalid notif_cadence' }, { status: 400 });
      }
      update.notif_cadence = body.notif_cadence;
    }

    if (body.remote_pref !== undefined) {
      if (!VALID_REMOTE_PREFS.has(body.remote_pref)) {
        return NextResponse.json({ error: 'Invalid remote_pref' }, { status: 400 });
      }
      update.remote_pref = body.remote_pref;
    }

    if (body.ic_or_lead !== undefined) {
      if (!VALID_IC_LEAD.has(body.ic_or_lead)) {
        return NextResponse.json({ error: 'Invalid ic_or_lead' }, { status: 400 });
      }
      update.ic_or_lead = body.ic_or_lead;
    }

    // Array fields — just validate they're arrays of strings
    if (body.target_roles !== undefined) {
      if (!Array.isArray(body.target_roles)) return NextResponse.json({ error: 'target_roles must be array' }, { status: 400 });
      update.target_roles = body.target_roles.map(String).filter(Boolean);
    }
    if (body.locations !== undefined) {
      if (!Array.isArray(body.locations)) return NextResponse.json({ error: 'locations must be array' }, { status: 400 });
      update.locations = body.locations.map(String).filter(Boolean);
    }
    if (body.company_stage !== undefined) {
      if (!Array.isArray(body.company_stage)) return NextResponse.json({ error: 'company_stage must be array' }, { status: 400 });
      update.company_stage = body.company_stage.map(String).filter(Boolean);
    }

    // Salary
    if (body.salary_min !== undefined) update.salary_min = Number(body.salary_min) || null;
    if (body.salary_max !== undefined) update.salary_max = Number(body.salary_max) || null;
    if (body.salary_currency !== undefined) update.salary_currency = String(body.salary_currency).slice(0, 10);

    // job_search_titles lives on profiles table, not users
    const hasJobSearchTitles = body.job_search_titles !== undefined;

    if (Object.keys(update).length === 0 && !hasJobSearchTitles) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from('users')
        .update(update)
        .eq('id', user.id);
      if (error) throw error;
    }

    if (hasJobSearchTitles) {
      const { error } = await supabase
        .from('profiles')
        .update({ job_search_titles: body.job_search_titles })
        .eq('user_id', user.id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[profile PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
