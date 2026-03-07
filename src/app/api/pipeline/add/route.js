/**
 * POST /api/pipeline/add
 *
 * Manually add a pipeline entry (application, outreach, or prospect).
 *
 * Body: { company, role_title, type, stage, notes }
 *
 * Schema CHECK values:
 *   type:  application | outreach | prospect
 *   stage: applied | confirmed | messaged | replied | interviewing | offer | rejected | ghosted | prospect
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_TYPES = new Set(['application', 'outreach', 'prospect']);
const VALID_STAGES = new Set([
  'applied', 'confirmed', 'messaged', 'replied',
  'interviewing', 'offer', 'rejected', 'ghosted', 'prospect',
]);

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { company, role_title, type = 'application', stage = 'applied', notes } = await request.json();

    if (!company?.trim()) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
    }
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (!VALID_STAGES.has(stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }

    const companyTrimmed = company.trim();

    const { data, error } = await supabase
      .from('pipeline')
      .insert({
        user_id: user.id,
        type,
        stage,
        company: companyTrimmed,
        company_logo_char: companyTrimmed[0].toUpperCase(),
        role_title: role_title?.trim() || null,
        notes: notes?.trim() || null,
        source: 'manual',
        applied_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .select('id, company, role_title, stage, type, applied_at, last_activity_at, source')
      .single();

    if (error) throw error;

    return NextResponse.json({ pipeline: data }, { status: 201 });
  } catch (err) {
    console.error('[pipeline/add]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
