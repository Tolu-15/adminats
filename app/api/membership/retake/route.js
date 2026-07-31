import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * POST /api/membership/retake
 * Body: { batch_id, student_unique_id_or_card }
 *
 * Public route — used when a student wants to re-enrol in Membership for a new batch.
 * They must already exist in the students table.
 * A new student_grades row is created (or the existing one reset) for the new batch.
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { batch_id, query } = body;

  if (!batch_id || !query) {
    return NextResponse.json({ error: 'batch_id and student ID/card number are required.' }, { status: 400 });
  }

  const q = query.trim();

  // 1. Verify the batch exists and is active
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type, is_active')
    .eq('id', batch_id)
    .single();

  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
  if (!batch.is_active) return NextResponse.json({ error: 'This batch is no longer active.' }, { status: 400 });

  // 2. Find the existing student by student_unique_id or card_number
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .select('id, first_name, surname, student_unique_id, card_number, batch_id')
    .or(`student_unique_id.eq.${q},card_number.eq.${q}`)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: 'No student found with that ID or card number. Please check and try again.' }, { status: 404 });

  // 3. Fetch their previous membership grade
  const { data: existingGrade } = await supabaseAdmin
    .from('student_grades')
    .select('id, status')
    .eq('student_id', student.id)
    .maybeSingle();

  const prevStatus = (existingGrade?.status || '').toUpperCase();

  // Block re-enrolment if they PASSED — they should go to MIT instead
  if (prevStatus === 'PASSED') {
    return NextResponse.json({
      error: `${student.first_name} ${student.surname} has already PASSED Membership. They should register for MIT instead.`,
    }, { status: 409 });
  }

  // 4. Update their batch_id to the new batch (re-enrol)
  await supabaseAdmin
    .from('students')
    .update({ batch_id })
    .eq('id', student.id);

  // 5. Reset their grade record for the fresh attempt (upsert blank grades, mark as retake)
  const gradePayload = {
    student_id: student.id,
    class: null,
    trainer: null,
    attendance: null,
    test: null,
    assignment: null,
    assessment: null,
    presentation: null,
    exam: null,
    final_grades: null,
    water_baptism: null,
    holy_spirit_baptism: null,
    portal: null,
    status: null,
    comments: `RETAKE — Previous batch: ${student.batch_id || 'N/A'}. Status was: ${prevStatus || 'NOT GRADED'}`,
    covenant_deed: null,
    updated_at: new Date().toISOString(),
  };

  if (existingGrade) {
    await supabaseAdmin.from('student_grades').update(gradePayload).eq('id', existingGrade.id);
  } else {
    await supabaseAdmin.from('student_grades').insert(gradePayload);
  }

  return NextResponse.json({
    success: true,
    isRetake: true,
    previousStatus: prevStatus || 'NOT GRADED',
    message: `${student.first_name} ${student.surname} has been re-enrolled in ${batch.batch_name} for a retake.`,
    student: {
      id: student.id,
      first_name: student.first_name,
      surname: student.surname,
      student_unique_id: student.student_unique_id,
    },
  });
}
