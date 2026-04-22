/**
 * GET /api/rolepitch/memory
 *
 * Returns the timeline of events (pitches + atoms) that feed the
 * Pilot's Memory neural visualization.
 *
 * Returns:
 *   {
 *     events: [{ id, type, label, desc, color, icon, created_at }],
 *     stats: { total_events, pitches_done, atoms_stored, best_match }
 *   }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Load pitches (tailored_resumes with jd_id)
    const { data: resumes } = await supabase
      .from('tailored_resumes')
      .select('id, jd_id, created_at, resume_strength, tailored_version, pipeline_version')
      .eq('user_id', user.id)
      .not('jd_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20);

    // Load JD titles
    const jdIds = [...new Set((resumes || []).map(r => r.jd_id).filter(Boolean))];
    let jdMap = new Map();
    if (jdIds.length) {
      const { data: jds } = await supabase
        .from('job_descriptions')
        .select('id, title, company')
        .in('id', jdIds);
      jdMap = new Map((jds || []).map(j => [j.id, j]));
    }

    // Load atoms
    const { data: atoms } = await supabase
      .from('user_experience_memory')
      .select('id, fact, nugget_type, confidence, created_at, company, role')
      .eq('user_id', user.id)
      .gte('confidence', 0.5)
      .order('created_at', { ascending: true })
      .limit(30);

    // Build chronological event list
    const rawEvents = [];

    // Upload event (use first resume created_at as proxy, or earliest atom)
    const firstTs = resumes?.[0]?.created_at || atoms?.[0]?.created_at;
    if (firstTs) {
      rawEvents.push({
        type: 'upload',
        label: 'Resume uploaded',
        desc: `${atoms?.length || 0} achievements extracted`,
        color: '#4f6ef7',
        icon: '📄',
        created_at: new Date(new Date(firstTs).getTime() - 60000).toISOString(),
      });
    }

    // Pitch events
    for (const r of resumes || []) {
      const jd = jdMap.get(r.jd_id) || {};
      const isV1 = r.pipeline_version === 'rolepitch-v1';
      const before = isV1 ? (r.tailored_version?.before_score || r.resume_strength || 63) : (r.resume_strength || 63);
      const after = isV1 ? (r.tailored_version?.after_score || before + 15) : Math.min(before + 18, 90);
      const atomsUsed = (r.tailored_version?.experience || []).reduce((n, role) => n + (role.bullets || []).length, 0);
      rawEvents.push({
        type: 'pitch',
        label: `Tailored for ${jd.title || 'Untitled'}${jd.company ? ' · ' + jd.company : ''}`,
        desc: `${atomsUsed} bullets · ${before}% → ${after}%`,
        color: '#4f6ef7',
        icon: '🎯',
        created_at: r.created_at,
        after_score: after,
        jd_title: jd.title || 'Untitled',
      });
    }

    // Atom events
    for (const a of atoms || []) {
      const typeMap = {
        achievement: { color: '#4f6ef7', icon: '⚡', label: 'Atom stored' },
        metric:      { color: '#22c55e', icon: '📊', label: 'Metric captured' },
        context:     { color: '#f59e0b', icon: '⚡', label: 'Context stored' },
        challenge:   { color: '#f43f5e', icon: '⚡', label: 'Challenge stored' },
      };
      const style = typeMap[a.nugget_type] || typeMap.achievement;
      rawEvents.push({
        type: 'fact',
        label: style.label,
        desc: a.fact?.slice(0, 60) + (a.fact?.length > 60 ? '…' : ''),
        color: style.color,
        icon: style.icon,
        created_at: a.created_at,
      });
    }

    // Sort chronologically
    rawEvents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Add milestone if best match ≥ 85%
    const pitchEvents = rawEvents.filter(e => e.type === 'pitch');
    const bestMatch = pitchEvents.reduce((best, e) => Math.max(best, e.after_score || 0), 0);
    if (bestMatch >= 80 && pitchEvents.length) {
      const bestPitch = pitchEvents.find(e => (e.after_score || 0) === bestMatch);
      rawEvents.push({
        type: 'milestone',
        label: `${bestMatch}% match — ${bestPitch?.jd_title || 'Best pitch'}`,
        desc: "Pilot's strongest pitch yet",
        color: '#22c55e',
        icon: '🏆',
        created_at: bestPitch?.created_at || new Date().toISOString(),
      });
      rawEvents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    // Assign IDs and x positions for the neural viz (spine at x=350)
    // Alternate left/right with some variance
    const xPositions = [350, 200, 490, 170, 520, 220, 490, 190, 510, 230, 490, 260, 350];
    const events = rawEvents.map((e, i) => ({
      id: i,
      ...e,
      x: e.type === 'upload' || e.type === 'milestone' ? 350 : (xPositions[i % xPositions.length] || 300),
    }));

    const stats = {
      total_events: events.length,
      pitches_done: events.filter(e => e.type === 'pitch').length,
      atoms_stored: events.filter(e => e.type === 'fact').length,
      best_match: bestMatch || null,
    };

    return NextResponse.json({ events, stats });
  } catch (err) {
    console.error('[rolepitch/memory]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
