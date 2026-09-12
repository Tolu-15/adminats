import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { logAdminAction } from '../../../../../lib/auditLog';

/**
 * POST /api/students/[id]/restore
 * Restores a soft-deleted student record by setting deleted_at = null.
 */
export async function POST(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });

  try {
    // Fetch student info before restore so we have the student's name
    const { data: st } = await supabaseAdmin
      .from('students')
      .select('first_name, surname, student_unique_id')
      .eq('id', id)
      .maybeSingle();

    const studentName = st ? [st.first_name, st.surname].filter(Boolean).join(' ') : 'Student';

    const { error } = await supabaseAdmin
      .from('students')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction({
      action: 'STUDENT_RESTORE',
      entityType: 'student',
      entityId: id,
      actor: user,
      details: {
        entity_name: studentName,
        student_id: id,
        student_unique_id: st?.student_unique_id || null,
        summary: `Restored student "${studentName}" (${st?.student_unique_id || 'ID'}) from Trash`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error restoring student:', err);
    return NextResponse.json({ error: err.message || 'Failed to restore student' }, { status: 500 });
  }
}
