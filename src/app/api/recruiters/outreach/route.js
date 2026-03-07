/**
 * POST /api/recruiters/outreach
 *
 * Generates (or returns cached) a Claude-drafted outreach message for a
 * specific recruiter match.
 *
 * Body: { match_id }
 *
 * Returns: { draft: string }
 *
 * Caching: if recruiter_matches.outreach_draft is already set, return it
 * immediately without calling Claude.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildOutreachPrompt } from '@/lib/ai/prompts/draft-outreach';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id } = await request.json();
    if (!match_id) return NextResponse.json({ error: 'match_id is required' }, { status: 400 });

    // Fetch match + recruiter (RLS ensures this is the user's own match)
    const { data: match, error: matchError } = await supabase
      .from('recruiter_matches')
      .select(`
        id, outreach_draft, user_id,
        recruiters!inner (
          id, name, title, current_company, specialization,
          geography, placements_at, response_rate
        )
      `)
      .eq('id', match_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Return cached draft if available
    if (match.outreach_draft) {
      return NextResponse.json({ draft: match.outreach_draft, cached: true });
    }

    // Fetch user profile + prefs
    const [{ data: userRow }, { data: profile }] = await Promise.all([
      supabase.from('users')
        .select('locations, target_roles, ic_or_lead, name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('profiles')
        .select('parsed_json')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // If no profile parsed_json, use minimal context from users table
    const userProfile = profile?.parsed_json
      ? profile
      : { parsed_json: { name: userRow?.name || '', seniority: 'experienced', years_exp: 5 } };

    const prompt = buildOutreachPrompt(
      userProfile,
      userRow,
      match.recruiters,
    );

    // Call Claude (Haiku for speed + cost)
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const draft = response.content[0]?.text?.trim() || '';
    if (!draft) throw new Error('Claude returned empty draft');

    // Cache the draft in recruiter_matches
    await supabase
      .from('recruiter_matches')
      .update({ outreach_draft: draft })
      .eq('id', match_id)
      .eq('user_id', user.id);

    return NextResponse.json({ draft, cached: false });
  } catch (err) {
    console.error('[recruiters/outreach]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
