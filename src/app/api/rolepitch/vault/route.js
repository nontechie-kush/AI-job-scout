/**
 * GET /api/rolepitch/vault
 *
 * Returns the user's career vault — atoms from user_experience_memory —
 * grouped by company + role, sorted newest first.
 *
 * Used by Step 2 (Vault Preview) of the RolePitch onboarding flow.
 *
 * Returns:
 *   {
 *     vault: [
 *       {
 *         company: string,
 *         role: string,
 *         period: string,          // "2022 – 2024"
 *         achievements: [
 *           {
 *             id: string,
 *             text: string,        // atom.fact
 *             metrics: string[],   // derived from atom.metric
 *             tags: string[],
 *           }
 *         ]
 *       }
 *     ],
 *     total: number
 *   }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatPeriod(startDate, endDate) {
  if (!startDate && !endDate) return '';
  const fmt = (d) => {
    if (!d) return 'Present';
    const date = new Date(d);
    return date.getFullYear().toString();
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function deriveMetrics(metric) {
  if (!metric) return [];
  const parts = [];
  if (metric.value !== undefined && metric.unit) {
    parts.push(`${metric.value}${metric.unit}`);
  } else if (metric.value !== undefined) {
    parts.push(String(metric.value));
  }
  return parts;
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: atoms, error } = await supabase
      .from('user_experience_memory')
      .select('id, company, role, start_date, end_date, fact, metric, tags, confidence, nugget_type')
      .eq('user_id', user.id)
      .gte('confidence', 0.5)
      .order('end_date', { ascending: false, nullsFirst: true });

    if (error) {
      console.error('[rolepitch/vault]', error);
      return NextResponse.json({ error: 'Failed to load vault' }, { status: 500 });
    }

    if (!atoms?.length) {
      return NextResponse.json({ vault: [], total: 0 });
    }

    // Group by company + role
    const groups = new Map();
    for (const atom of atoms) {
      const key = `${atom.company || ''}::${atom.role || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          company: atom.company || 'Unknown Company',
          role: atom.role || 'Unknown Role',
          start_date: atom.start_date,
          end_date: atom.end_date,
          achievements: [],
        });
      }
      groups.get(key).achievements.push({
        id: atom.id,
        text: atom.fact,
        metrics: deriveMetrics(atom.metric),
        tags: atom.tags || [],
        nugget_type: atom.nugget_type,
      });
    }

    const vault = [...groups.values()].map((g) => ({
      company: g.company,
      role: g.role,
      period: formatPeriod(g.start_date, g.end_date),
      achievements: g.achievements,
    }));

    return NextResponse.json({ vault, total: atoms.length });

  } catch (err) {
    console.error('[rolepitch/vault]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
