/**
 * POST /api/ai/resume-apply-changes
 *
 * Body: { tailored_resume_id: string, accepted_changes: [{id, action, section, entry_id, bullet_id, before, after}] }
 *
 * Applies accepted changes to the tailored resume's tailored_version.
 * Pure data manipulation — no AI model needed.
 *
 * Returns: { tailored_version, changes_applied }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tailored_resume_id, accepted_changes } = await request.json();
    if (!tailored_resume_id || !Array.isArray(accepted_changes) || accepted_changes.length === 0) {
      return NextResponse.json({ error: 'tailored_resume_id and accepted_changes required' }, { status: 400 });
    }

    // Fetch current tailored resume
    const { data: tailored } = await supabase
      .from('tailored_resumes')
      .select('id, tailored_version, changes')
      .eq('id', tailored_resume_id)
      .eq('user_id', user.id)
      .single();

    if (!tailored) {
      return NextResponse.json({ error: 'Tailored resume not found' }, { status: 404 });
    }

    const version = { ...tailored.tailored_version };
    const changeLog = [...(tailored.changes || [])];
    let applied = 0;

    for (const change of accepted_changes) {
      const { action, section, entry_id, bullet_id, before, after, entry_hint } = change;

      if (section === 'experience' || section === 'projects') {
        const entries = version[section] || [];
        // Resolve target entry: prefer explicit entry_id, fall back to entry_hint
        // (company or role name), fall back to most recent entry.
        let entryIdx = entry_id ? entries.findIndex((e) => e.id === entry_id) : -1;
        if (entryIdx === -1 && entry_hint && entries.length) {
          const hint = String(entry_hint).toLowerCase();
          entryIdx = entries.findIndex((e) => {
            const company = (e.company || '').toLowerCase();
            const title = (e.title || '').toLowerCase();
            return company.includes(hint) || hint.includes(company) ||
                   title.includes(hint) || hint.includes(title);
          });
        }
        if (entryIdx === -1 && action === 'add' && entries.length) {
          // For an 'add' with no resolvable target, default to the most recent entry.
          entryIdx = 0;
        }
        if (entryIdx === -1) continue;

        const entry = { ...entries[entryIdx] };
        const bullets = [...(entry.bullets || [])];

        if (action === 'replace' && bullet_id) {
          const bulletIdx = bullets.findIndex((b) => b.id === bullet_id);
          if (bulletIdx !== -1) {
            bullets[bulletIdx] = {
              ...bullets[bulletIdx],
              text: after,
              tags: bullets[bulletIdx].tags || [],
            };
            applied++;
          }
        } else if (action === 'add') {
          // Generate a new bullet ID
          const maxId = bullets.reduce((max, b) => {
            const num = parseInt(b.id.replace(/\D/g, ''), 10);
            return num > max ? num : max;
          }, 0);
          bullets.push({
            id: `b_${String(maxId + 1).padStart(3, '0')}`,
            text: after,
            tags: [],
          });
          applied++;
        }

        entry.bullets = bullets;
        entries[entryIdx] = entry;
        version[section] = entries;
      } else if (section === 'summary') {
        version.summary = after;
        applied++;
      }

      // Log the change
      changeLog.push({
        ...change,
        applied_at: new Date().toISOString(),
      });
    }

    // Update the tailored resume
    await supabase
      .from('tailored_resumes')
      .update({
        tailored_version: version,
        changes: changeLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tailored_resume_id);

    return NextResponse.json({
      tailored_version: version,
      changes_applied: applied,
    });
  } catch (err) {
    console.error('[resume-apply-changes]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
