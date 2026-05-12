/**
 * GET /api/rolepitch/vault
 *
 * Returns the user's career vault — derived from profiles.parsed_json.experience.
 * Each role's bullets become achievements, grouped by company + role.
 *
 * (Previously read from user_experience_memory which the RolePitch flow
 * never populates — that table is from the legacy v2 atom pipeline.)
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatPeriod(startDate, endDate) {
  if (!startDate && !endDate) return '';
  const fmt = (d) => {
    if (!d) return 'Present';
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.getFullYear().toString();
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function extractMetrics(text) {
  if (!text) return [];
  const patterns = [
    /\$[\d,.]+[KMB]?/gi,
    /\d+(?:\.\d+)?%/g,
    /\d+(?:,\d{3})+/g,
    /\b\d+(?:\.\d+)?[KMB]\b/gi,
    /\b\d+x\b/gi,
  ];
  const found = new Set();
  for (const re of patterns) {
    const matches = text.match(re) || [];
    matches.forEach(m => found.add(m));
  }
  return [...found].slice(0, 3);
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('parsed_json, structured_resume')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[rolepitch/vault]', error);
      return NextResponse.json({ error: 'Failed to load vault' }, { status: 500 });
    }

    const source = profile?.structured_resume || profile?.parsed_json || null;
    const experience = source?.experience || [];

    if (!experience.length) {
      return NextResponse.json({ vault: [], total: 0 });
    }

    let total = 0;
    const vault = experience.map((role, roleIdx) => {
      const bullets = role.bullets || [];
      const achievements = bullets.map((b, i) => {
        const text = typeof b === 'string' ? b : (b.text || '');
        total += 1;
        return {
          id: `${roleIdx}-${i}`,
          text,
          metrics: extractMetrics(text),
          tags: [],
          nugget_type: typeof b === 'object' ? (b.type || 'achievement') : 'achievement',
        };
      }).filter(a => a.text);

      return {
        company: role.company || 'Unknown Company',
        role: role.title || 'Unknown Role',
        period: formatPeriod(role.start_date, role.end_date),
        achievements,
      };
    }).filter(g => g.achievements.length);

    return NextResponse.json({ vault, total });

  } catch (err) {
    console.error('[rolepitch/vault]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
