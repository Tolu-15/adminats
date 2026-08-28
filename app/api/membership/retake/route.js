import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

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

  // 1. Verify batch exists and is active
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type, is_active')
    .eq('id', batch_id)
    .single();

  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
  if (!batch.is_active) return NextResponse.json({ error: 'This batch is no longer active.' }, { status: 400 });

  // 2. Find student by ID or card number
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .select('id, first_name, surname, student_unique_id, card_number, batch_id')
    .or(`student_unique_id.eq.${q},card_number.eq.${q}`)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: 'No student found with that ID or card number. Please check and try again.' }, { status: 404 });

  // 3. Get existing membership registration & grade
  let { data: memReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', student.id)
    .eq('stage', 'membership')
    .maybeSingle();

  let prevStatus = '';
  if (memReg) {
    const { data: existingGrade } = await supabaseAdmin
      .from('membership_grades')
      .select('status')
      .eq('registration_id', memReg.id)
      .maybeSingle();

    prevStatus = (existingGrade?.status || '').toUpperCase();
  }

  if (prevStatus === 'PASSED') {
    return NextResponse.json({
      error: `${student.first_name} ${student.surname} has already PASSED Membership. They should register for MIT instead.`,
    }, { status: 409 });
  }

  // 4. Update student's current batch_id
  await supabaseAdmin
    .from('students')
    .update({ batch_id })
    .eq('id', student.id);

  // 5. Upsert registration for Membership stage
  if (!memReg) {
    const { data: newReg } = await supabaseAdmin
      .from('registrations')
      .insert({
        student_id: student.id,
        batch_id,
        stage: 'membership',
      })
      .select('id')
      .single();
    memReg = newReg;
  } else {
    await supabaseAdmin
      .from('registrations')
      .update({ batch_id })
      .eq('id', memReg.id);
  }

  // 6. Reset membership grade record for fresh attempt
  const gradePayload = {
    registration_id: memReg.id,
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

  await supabaseAdmin
    .from('membership_grades')
    .upsert(gradePayload, { onConflict: 'registration_id' });

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
