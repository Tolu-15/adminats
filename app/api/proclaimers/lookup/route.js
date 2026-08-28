import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ error: 'Query required.' }, { status: 400 });

  // 1. Search student
  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select(`
      id, student_unique_id, surname, first_name, middle_name,
      phone, email, date_of_birth, gender, photo_url,
      card_number, church_join_date, batch_id
    `)
    .or(`student_unique_id.eq.${q},card_number.eq.${q}`)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: 'No student found with that ID or card number.' }, { status: 404 });

  // 2. Check Membership status
  const { data: memReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', student.id)
    .eq('stage', 'membership')
    .maybeSingle();

  let memStatus = '';
  if (memReg) {
    const { data: grade } = await supabaseAdmin
      .from('membership_grades')
      .select('status')
      .eq('registration_id', memReg.id)
      .maybeSingle();
    memStatus = (grade?.status || '').toString().trim().toUpperCase();
  }

  if (memStatus !== 'PASSED') {
    return NextResponse.json({
      error: 'This student has not passed Membership class and is not eligible for Proclaimers registration.',
      student: {
        name: `${student.first_name} ${student.surname}`,
        student_unique_id: student.student_unique_id,
        membership_status: memStatus || 'NOT GRADED',
        mit_status: 'PENDING',
      },
    }, { status: 403 });
  }

  // 3. Check MIT status
  const { data: mitReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', student.id)
    .eq('stage', 'mit')
    .maybeSingle();

  let mitStatus = 'NOT REGISTERED';
  let passedMit = false;
  if (mitReg) {
    const { data: mitGrade } = await supabaseAdmin
      .from('mit_grades')
      .select('status')
      .eq('registration_id', mitReg.id)
      .maybeSingle();
    mitStatus = (mitGrade?.status || '').toString().trim().toUpperCase();
    passedMit = mitStatus === 'PASSED';
  }

  if (!passedMit) {
    return NextResponse.json({
      error: 'This student has not passed MIT class and is not eligible for Proclaimers registration.',
      student: {
        name: `${student.first_name} ${student.surname}`,
        student_unique_id: student.student_unique_id,
        membership_status: 'PASSED',
        mit_status: mitStatus,
      },
    }, { status: 403 });
  }

  return NextResponse.json({
    student: {
      id: student.id,
      student_unique_id: student.student_unique_id,
      surname: student.surname,
      first_name: student.first_name,
      middle_name: student.middle_name,
      full_name: [student.first_name, student.middle_name, student.surname].filter(Boolean).join(' '),
      phone: student.phone,
      email: student.email,
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      photo_url: student.photo_url,
      card_number: student.card_number,
      church_join_date: student.church_join_date,
      membership_status: memStatus,
      mit_status: 'PASSED',
    },
  });
}
