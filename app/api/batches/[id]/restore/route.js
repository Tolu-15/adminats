import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { logAdminAction } from '../../../../../lib/auditLog';

/**
 * POST /api/batches/[id]/restore
 * Restores a soft-deleted batch and its students by clearing their deleted_at timestamp.
 */
export async function POST(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });

  try {
    // Fetch batch name before restore
    const { data: bData } = await supabaseAdmin
      .from('batches')
      .select('batch_name, batch_code')
      .eq('id', id)
      .maybeSingle();

    const batchName = bData?.batch_name || 'Batch';

    // 1. Restore the batch
    const { error: bErr } = await supabaseAdmin
      .from('batches')
      .update({ deleted_at: null })
      .eq('id', id);

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    // 2. Restore all students belonging to this batch that were soft-deleted
    await supabaseAdmin
      .from('students')
      .update({ deleted_at: null })
      .eq('batch_id', id);

    // 3. Record audit log
    await logAdminAction({
      action: 'BATCH_RESTORE',
      entityType: 'batch',
      entityId: id,
      actor: user,
      details: {
        entity_name: batchName,
        batch_code: bData?.batch_code || null,
        summary: `Restored batch "${batchName}" and its students from Trash`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error restoring batch:', err);
    return NextResponse.json({ error: err.message || 'Failed to restore batch' }, { status: 500 });
  }
}
