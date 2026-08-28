import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { batch_id, membership_student_id, department } = body;

  if (!batch_id || !membership_student_id) {
    return NextResponse.json({ error: 'batch_id and membership_student_id are required.' }, { status: 400 });
  }

  // 1. Verify the batch exists and is active
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type, is_active')
    .eq('id', batch_id)
    .single();

  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
  if (!batch.is_active) return NextResponse.json({ error: 'This batch is no longer active.' }, { status: 400 });

  // 2. Verify student exists
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .select('id, first_name, surname, church_join_date')
    .eq('id', membership_student_id)
    .single();

  if (sErr || !student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // 3. Check Membership PASSED
  const { data: memReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', membership_student_id)
    .eq('stage', 'membership')
    .maybeSingle();

  let hasPassed = false;
  if (memReg) {
    const { data: grade } = await supabaseAdmin
      .from('membership_grades')
      .select('status')
      .eq('registration_id', memReg.id)
      .maybeSingle();
    const statusRaw = (grade?.status || '').toString().trim().toUpperCase();
    hasPassed = statusRaw === 'PASSED';
  }

  if (!hasPassed) {
    return NextResponse.json({ error: 'Student has not passed Membership. MIT registration denied.' }, { status: 403 });
  }

  // 4. Check if already registered for MIT in THIS batch
  const { data: existing } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', membership_student_id)
    .eq('stage', 'mit')
    .eq('batch_id', batch_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This student is already registered for this MIT batch.' }, { status: 409 });
  }

  // 5. Check for prior MIT registrations (for retake comments)
  const { data: priorMit } = await supabaseAdmin
    .from('registrations')
    .select('id, batch_id, mit_grades(status)')
    .eq('student_id', membership_student_id)
    .eq('stage', 'mit');

  const isRetake = priorMit && priorMit.length > 0;
  const prevStatuses = (priorMit || []).map((r) => {
    const g = Array.isArray(r.mit_grades) ? r.mit_grades[0] : r.mit_grades;
    return (g?.status || 'NOT GRADED').toUpperCase();
  });

  // 6. Create MIT registration in registrations table (upsert/insert if retake allows re-enrollment)
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('registrations')
    .upsert({
      student_id: membership_student_id,
      batch_id,
      stage: 'mit',
      department: department?.trim() || null,
    }, { onConflict: 'student_id,stage' })
    .select()
    .single();

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  // 7. Create/reset mit_grades record
  await supabaseAdmin.from('mit_grades').upsert({
    registration_id: reg.id,
    first_timer_date: student.church_join_date || null,
    comments: isRetake
      ? `RETAKE — Previously attempted MIT. Prior status(es): ${prevStatuses.join(', ')}`
      : null,
  }, { onConflict: 'registration_id' });

  return NextResponse.json({
    success: true,
    isRetake,
    message: isRetake
      ? `${student.first_name} ${student.surname} has been re-enrolled in ${batch.batch_name} for a MIT retake.`
      : `${student.first_name} ${student.surname} has been registered for ${batch.batch_name}.`,
    registration_id: reg.id,
  });
}
