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

    // Fetch match + recruiter
    const { data: match, error: matchError } = await supabase
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
      .maybeSingle();

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

    // TODO: re-enable Claude-generated messages when ready.
    // Using fixed defaults for now to avoid API costs during testing.
    const genNote = 'Hi, It would be great to connect. Regards Kushendra';
    const genDmSubject = 'Connecting on LinkedIn';
    const genDmBody = 'Hi, It would be great to connect. Regards Kushendra';

    // Build result based on mode
    let result;
    if (mode === 'connect_only') {
      const safeNote = genNote.slice(0, 200);
      result = { connection_note: safeNote, dm_subject: '', dm_body: '' };
    } else if (mode === 'dm_draft') {
      result = { connection_note: cached?.connection_note || '', dm_subject: genDmSubject, dm_body: genDmBody };
    } else {
      const safeNote = genNote.slice(0, 200);
      result = { connection_note: safeNote, dm_subject: genDmSubject, dm_body: genDmBody };
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
