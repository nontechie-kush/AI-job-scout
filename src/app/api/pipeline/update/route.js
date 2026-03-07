/**
 * PATCH /api/pipeline/update
 *
 * Updates a pipeline entry's stage or notes.
 * Called by the Kanban drag-and-drop and manual edits.
 *
 * Body: { id, stage?, notes? }
 *
 * schema CHECK: stage IN ('applied','confirmed','messaged','replied',
 *                         'interviewing','offer','rejected','ghosted','prospect')
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { recordSignal } from '@/lib/flywheel/signals';

const VALID_STAGES = new Set([
  'applied', 'confirmed', 'messaged', 'replied',
  'interviewing', 'offer', 'rejected', 'ghosted', 'prospect',
]);

export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, stage, notes } = await request.json();

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (stage !== undefined && !VALID_STAGES.has(stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }

    const update = { last_activity_at: new Date().toISOString() };
    if (stage !== undefined) update.stage = stage;
    if (notes !== undefined) update.notes = notes;

    const { data: pipeRow, error } = await supabase
      .from('pipeline')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id) // RLS guard
      .select('company, applied_at, source')
      .maybeSingle();

    if (error) throw error;

    // Fire-and-forget flywheel signal for meaningful stage transitions
    if (stage && ['interviewing', 'offer', 'rejected', 'ghosted'].includes(stage) && pipeRow) {
      const outcomeMap = {
        interviewing: 'interview',
        offer: 'offer',
        rejected: 'rejected',
        ghosted: 'ghosted',
      };
      const appliedAt = pipeRow.applied_at ? new Date(pipeRow.applied_at) : null;
      const days = appliedAt
        ? Math.round((Date.now() - appliedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const serviceClient = createServiceClient();
      recordSignal(serviceClient, {
        type: 'job_outcome',
        company_domain: pipeRow.company || null,
        job_source: pipeRow.source || null,
        outcome: outcomeMap[stage],
        time_to_outcome_days: days,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pipeline/update]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/pipeline/update — remove a pipeline entry
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await supabase
      .from('pipeline')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pipeline/update DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
