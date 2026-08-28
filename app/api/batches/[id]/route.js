import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export async function DELETE(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // ── 1. Get student IDs that BELONG to this batch (via students.batch_id) ──
  const { data: studentRows } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('batch_id', id);
  const studentIds = (studentRows || []).map((s) => s.id);

  if (studentIds.length > 0) {
    // ── 2. Find ALL mit_registrations that reference these students (ANY batch) ──
    const { data: mitByStudent } = await supabaseAdmin
      .from('mit_registrations')
      .select('id')
      .in('membership_student_id', studentIds);
    const mitByStudentIds = (mitByStudent || []).map((r) => r.id);

    if (mitByStudentIds.length > 0) {
      await supabaseAdmin.from('mit_grades').delete().in('mit_registration_id', mitByStudentIds);
      await supabaseAdmin.from('mit_registrations').delete().in('id', mitByStudentIds);
    }

    // ── 3. Find ALL proclaimers_registrations that reference these students (ANY batch) ──
    const { data: procByStudent } = await supabaseAdmin
      .from('proclaimers_registrations')
      .select('id')
      .in('membership_student_id', studentIds);
    const procByStudentIds = (procByStudent || []).map((r) => r.id);

    if (procByStudentIds.length > 0) {
      await supabaseAdmin.from('proclaimers_grades').delete().in('proclaimers_registration_id', procByStudentIds);
      await supabaseAdmin.from('proclaimers_registrations').delete().in('id', procByStudentIds);
    }

    // ── 4. Delete student grades ───────────────────────────────────────────────
    await supabaseAdmin.from('membership_grades').delete().in('student_id', studentIds);

    // ── 5. Delete the membership students ─────────────────────────────────────
    await supabaseAdmin.from('students').delete().in('id', studentIds);
  }

  // ── 6. Delete any MIT registrations INTO this batch (students from other batches) ──
  const { data: mitInBatch } = await supabaseAdmin
    .from('mit_registrations')
    .select('id')
    .eq('batch_id', id);
  const mitInBatchIds = (mitInBatch || []).map((r) => r.id);

  if (mitInBatchIds.length > 0) {
    await supabaseAdmin.from('mit_grades').delete().in('mit_registration_id', mitInBatchIds);
    await supabaseAdmin.from('mit_registrations').delete().in('id', mitInBatchIds);
  }

  // ── 7. Delete any Proclaimers registrations INTO this batch ───────────────────
  const { data: procInBatch } = await supabaseAdmin
    .from('proclaimers_registrations')
    .select('id')
    .eq('batch_id', id);
  const procInBatchIds = (procInBatch || []).map((r) => r.id);

  if (procInBatchIds.length > 0) {
    await supabaseAdmin.from('proclaimers_grades').delete().in('proclaimers_registration_id', procInBatchIds);
    await supabaseAdmin.from('proclaimers_registrations').delete().in('id', procInBatchIds);
  }

  // ── 8. Now it is safe to delete the batch ────────────────────────────────────
  const { error } = await supabaseAdmin.from('batches').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
