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

  const deptTrimmed = (department || '').trim();
  if (!deptTrimmed) {
    return NextResponse.json({ error: 'Department is compulsory for Proclaimers registration.' }, { status: 400 });
  }

  // 1. Verify batch exists and is active
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
    .select('id, first_name, surname')
    .eq('id', membership_student_id)
    .single();

  if (sErr || !student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // 3. Verify Membership PASSED
  const { data: memReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', membership_student_id)
    .eq('stage', 'membership')
    .maybeSingle();

  let memPassed = false;
  if (memReg) {
    const { data: memGrade } = await supabaseAdmin
      .from('membership_grades')
      .select('status')
      .eq('registration_id', memReg.id)
      .maybeSingle();
    const memStatus = (memGrade?.status || '').toString().trim().toUpperCase();
    memPassed = memStatus === 'PASSED';
  }

  if (!memPassed) {
    return NextResponse.json({ error: 'Student has not passed Membership class. Proclaimers registration denied.' }, { status: 403 });
  }

  // 4. Verify MIT PASSED
  const { data: mitReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', membership_student_id)
    .eq('stage', 'mit')
    .maybeSingle();

  let mitPassed = false;
  if (mitReg) {
    const { data: mitGrade } = await supabaseAdmin
      .from('mit_grades')
      .select('status')
      .eq('registration_id', mitReg.id)
      .maybeSingle();
    const mitStatus = (mitGrade?.status || '').toString().trim().toUpperCase();
    mitPassed = mitStatus === 'PASSED';
  }

  if (!mitPassed) {
    return NextResponse.json({ error: 'Student has not completed/passed MIT class. Proclaimers registration denied.' }, { status: 403 });
  }

  // 5. Check not already registered in this Proclaimers batch
  const { data: existing } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', membership_student_id)
    .eq('stage', 'proclaimers')
    .eq('batch_id', batch_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This student is already registered for this Proclaimers batch.' }, { status: 409 });
  }

  // 6. Create Proclaimers registration in registrations table
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('registrations')
    .upsert({
      student_id: membership_student_id,
      batch_id,
      stage: 'proclaimers',
      department: deptTrimmed,
    }, { onConflict: 'student_id,stage' })
    .select()
    .single();

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  // 7. Create initial proclaimers_grades record
  await supabaseAdmin.from('proclaimers_grades').upsert({
    registration_id: reg.id,
  }, { onConflict: 'registration_id' });

  return NextResponse.json({
    success: true,
    message: `${student.first_name} ${student.surname} has been registered for ${batch.batch_name} (Proclaimers).`,
    registration_id: reg.id,
  });
}
