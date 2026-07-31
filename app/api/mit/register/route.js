import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * POST /api/mit/register
 * Body: { batch_id, membership_student_id, department }
 *
 * Public route — called from the public MIT registration page.
 * Re-validates eligibility (PASSED Membership) server-side.
 * Allows retake: if student previously FAILED or has incomplete MIT in another batch,
 * they can register for a new MIT batch.
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { batch_id, membership_student_id, department } = body;

  if (!batch_id || !membership_student_id) {
    return NextResponse.json({ error: 'batch_id and membership_student_id are required.' }, { status: 400 });
  }

  // 1. Verify the batch exists
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type, is_active')
    .eq('id', batch_id)
    .single();

  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
  if (!batch.is_active) return NextResponse.json({ error: 'This batch is no longer active.' }, { status: 400 });

  // 2. Verify the student exists
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .select('id, first_name, surname, church_join_date')
    .eq('id', membership_student_id)
    .single();

  if (sErr || !student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // 3. Check Membership PASSED
  const { data: grade } = await supabaseAdmin
    .from('student_grades')
    .select('status')
    .eq('student_id', membership_student_id)
    .maybeSingle();

  const statusRaw = (grade?.status || '').toString().trim().toUpperCase();
  const hasPassed = statusRaw === 'PASSED';
  if (!hasPassed) {
    return NextResponse.json({ error: 'Student has not passed Membership. MIT registration denied.' }, { status: 403 });
  }

  // 4. Check not already registered in THIS specific MIT batch (prevent duplicate in same batch)
  const { data: existing } = await supabaseAdmin
    .from('mit_registrations')
    .select('id')
    .eq('batch_id', batch_id)
    .eq('membership_student_id', membership_student_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This student is already registered for this MIT batch.' }, { status: 409 });
  }

  // 5. Check for any prior MIT history (for retake tracking)
  const { data: priorMit } = await supabaseAdmin
    .from('mit_registrations')
    .select('id, batch_id, mit_grades(status)')
    .eq('membership_student_id', membership_student_id);

  const isRetake = priorMit && priorMit.length > 0;
  const prevStatuses = (priorMit || []).map((r) => {
    const g = Array.isArray(r.mit_grades) ? r.mit_grades[0] : r.mit_grades;
    return (g?.status || 'NOT GRADED').toUpperCase();
  });

  // 6. Create the MIT registration
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('mit_registrations')
    .insert({
      batch_id,
      membership_student_id,
      department: department?.trim() || null,
    })
    .select()
    .single();

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  // 7. Create blank mit_grades record, note retake in comments if applicable
  await supabaseAdmin.from('mit_grades').insert({
    mit_registration_id: reg.id,
    department: department?.trim() || null,
    first_timer_date: student.church_join_date || null,
    comments: isRetake
      ? `RETAKE — Previously attempted MIT. Prior status(es): ${prevStatuses.join(', ')}`
      : null,
  });

  return NextResponse.json({
    success: true,
    isRetake,
    message: isRetake
      ? `${student.first_name} ${student.surname} has been re-enrolled in ${batch.batch_name} for a MIT retake.`
      : `${student.first_name} ${student.surname} has been registered for ${batch.batch_name}.`,
    registration_id: reg.id,
  });
}
