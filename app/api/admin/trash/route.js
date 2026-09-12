import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { logAdminAction } from '../../../../lib/auditLog';
import { cascadeDeleteBatch, cascadeDeleteStudents } from '../../../../lib/batchCleanup';

/**
 * GET /api/admin/trash
 * Retrieves soft-deleted batches and soft-deleted students.
 */
export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Fetch soft-deleted batches
    const { data: batchesData, error: bErr } = await supabaseAdmin
      .from('batches')
      .select('id, batch_code, batch_name, programme_type, created_at, deleted_at, students(count)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    // If deleted_at column does not exist yet in DB
    if (bErr && (bErr.code === '42703' || bErr.code === 'PGRST204')) {
      return NextResponse.json({
        batches: [],
        students: [],
        columnMissing: true,
      });
    }

    // 2. Fetch soft-deleted students
    const { data: studentsData, error: sErr } = await supabaseAdmin
      .from('students')
      .select('id, student_unique_id, surname, first_name, middle_name, email, phone, created_at, deleted_at, batch_id, batch:batches(batch_name, batch_code)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (sErr && (sErr.code === '42703' || sErr.code === 'PGRST204')) {
      return NextResponse.json({
        batches: batchesData || [],
        students: [],
        columnMissing: true,
      });
    }

    return NextResponse.json({
      batches: batchesData || [],
      students: studentsData || [],
      columnMissing: false,
    });
  } catch (err) {
    console.error('Error fetching trash records:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch trash' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/trash
 * Permanently purges a soft-deleted batch, student, or empties all items in trash.
 */
export async function DELETE(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'batch' | 'student' | 'all'
    const id = searchParams.get('id');

    // 1. Permanently delete single student from trash
    if (type === 'student' && id) {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('first_name, surname, student_unique_id')
        .eq('id', id)
        .maybeSingle();

      const studentName = st ? [st.first_name, st.surname].filter(Boolean).join(' ') : 'Student';

      await cascadeDeleteStudents([id]);

      await logAdminAction({
        action: 'STUDENT_DELETE',
        entityType: 'student',
        entityId: id,
        actor: user,
        details: {
          entity_name: studentName,
          student_unique_id: st?.student_unique_id || null,
          mode: 'permanent_purge',
          summary: `Permanently purged student "${studentName}" from trash`,
        },
      });

      return NextResponse.json({ success: true, message: `Student "${studentName}" permanently deleted.` });
    }

    // 2. Permanently delete single batch and its associated data
    if (type === 'batch' && id) {
      const { data: bData } = await supabaseAdmin
        .from('batches')
        .select('batch_name, batch_code')
        .eq('id', id)
        .maybeSingle();

      const batchName = bData?.batch_name || 'Batch';

      await cascadeDeleteBatch(id);

      await logAdminAction({
        action: 'BATCH_DELETE',
        entityType: 'batch',
        entityId: id,
        actor: user,
        details: {
          entity_name: batchName,
          batch_code: bData?.batch_code || null,
          mode: 'permanent_purge',
          summary: `Permanently purged batch "${batchName}" and all associated records from trash`,
        },
      });

      return NextResponse.json({ success: true, message: `Batch "${batchName}" permanently deleted.` });
    }

    // 3. Empty all items currently in trash
    if (type === 'all') {
      const { data: trashedBatches } = await supabaseAdmin
        .from('batches')
        .select('id, batch_name')
        .not('deleted_at', 'is', null);

      for (const b of trashedBatches || []) {
        await cascadeDeleteBatch(b.id);
      }

      const { data: trashedStudents } = await supabaseAdmin
        .from('students')
        .select('id')
        .not('deleted_at', 'is', null);

      const stuIds = (trashedStudents || []).map((s) => s.id);
      if (stuIds.length > 0) {
        await cascadeDeleteStudents(stuIds);
      }

      const bCount = (trashedBatches || []).length;
      const sCount = stuIds.length;

      await logAdminAction({
        action: 'BATCH_DELETE',
        entityType: 'trash',
        entityId: 'all',
        actor: user,
        details: {
          mode: 'empty_trash',
          batches_count: bCount,
          students_count: sCount,
          summary: `Emptied trash: permanently purged ${bCount} batch(es) and ${sCount} student(s)`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Trash emptied: ${bCount} batch(es) and ${sCount} student(s) permanently removed.`,
      });
    }

    return NextResponse.json({ error: 'Missing or invalid delete parameters.' }, { status: 400 });
  } catch (err) {
    console.error('Error permanently deleting from trash:', err);
    return NextResponse.json({ error: err.message || 'Failed to permanently delete from trash' }, { status: 500 });
  }
}
