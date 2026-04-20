/**
 * POST /api/recruiters/outreach
 *
 * Generates (or returns cached) Claude-drafted outreach for a recruiter match.
 *
 * Body: { match_id, mode? }
 *   mode: 'connect_only' (default) — only generate connection_note (saves AI credits)
 *         'dm_draft'               — only generate dm_subject + dm_body (called at cascade time)
 *         'all'                    — generate all three (legacy)
 *
 * Returns: { connection_note, dm_subject, dm_body, cached }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildOutreachPrompt } from '@/lib/ai/prompts/draft-outreach';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, mode = 'connect_only' } = await request.json();
    if (!match_id) return NextResponse.json({ error: 'match_id is required' }, { status: 400 });

    // Fetch match + recruiter + user profile + prefs in parallel
    const [{ data: match, error: matchError }, { data: profileRow }, { data: userRow }] = await Promise.all([
      supabase
        .from('recruiter_matches')
        .select(`
          id, outreach_draft, user_id,
          recruiters!inner (
            id, name, title, current_company, specialization,
            geography, placements_at, response_rate, linkedin_url
          )
        `)
        .eq('id', match_id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('parsed_json')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('users')
        .select('target_roles, pilot_mode')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (matchError) throw new Error(`Match query failed: ${matchError.message}`);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Check cached draft
    let cached = null;
    if (match.outreach_draft) {
      try { cached = JSON.parse(match.outreach_draft); } catch { /* old format */ }
    }

    // Return cached if it already has what we need
    if (cached) {
      const hasNote = !!cached.connection_note;
      const hasDm = !!cached.dm_body;
      if (mode === 'connect_only' && hasNote) {
        return NextResponse.json({ connection_note: cached.connection_note, dm_subject: '', dm_body: '', cached: true });
      }
      if (mode === 'dm_draft' && hasDm) {
        return NextResponse.json({ connection_note: cached.connection_note || '', dm_subject: cached.dm_subject || '', dm_body: cached.dm_body, cached: true });
      }
      if (mode === 'all' && hasNote && hasDm) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    // Generate with Claude Haiku
    const prompt = buildOutreachPrompt(
      profileRow || {},
      userRow || {},
      match.recruiters,
      userRow?.pilot_mode || 'steady',
    );

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });

    let generated = { connection_note: '', dm_subject: '', dm_body: '' };
    try {
      const raw = msg.content[0].text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      generated = JSON.parse(raw);
    } catch { /* use empty fallback */ }

    // Build result based on mode
    let result;
    if (mode === 'connect_only') {
      result = { connection_note: (generated.connection_note || '').slice(0, 200), dm_subject: '', dm_body: '' };
    } else if (mode === 'dm_draft') {
      result = { connection_note: cached?.connection_note || '', dm_subject: generated.dm_subject || '', dm_body: generated.dm_body || '' };
    } else {
      result = { connection_note: (generated.connection_note || '').slice(0, 200), dm_subject: generated.dm_subject || '', dm_body: generated.dm_body || '' };
    }

    // Merge with existing cache and store
    const merged = { ...(cached || {}), ...result };
    await supabase
      .from('recruiter_matches')
      .update({ outreach_draft: JSON.stringify(merged) })
      .eq('id', match_id)
      .eq('user_id', user.id);

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error('[recruiters/outreach]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
