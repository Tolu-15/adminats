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

  // 2. Check Membership PASSED via registrations -> membership_grades
  const { data: memReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', student.id)
    .eq('stage', 'membership')
    .maybeSingle();

  let statusRaw = '';
  if (memReg) {
    const { data: grade } = await supabaseAdmin
      .from('membership_grades')
      .select('status')
      .eq('registration_id', memReg.id)
      .maybeSingle();
    statusRaw = (grade?.status || '').toString().trim();
  }

  const hasPassed = statusRaw.toUpperCase() === 'PASSED';

  if (!hasPassed) {
    return NextResponse.json({
      error: 'This student has not passed Membership class and is not eligible for MIT registration.',
      student: {
        name: `${student.first_name} ${student.surname}`,
        student_unique_id: student.student_unique_id,
        status: statusRaw || 'NOT GRADED',
      },
    }, { status: 403 });
  }

  // 3. Check prior MIT history
  const { data: priorMit } = await supabaseAdmin
    .from('registrations')
    .select('id, batch_id, batch:batches(batch_name), mit_grades(status)')
    .eq('student_id', student.id)
    .eq('stage', 'mit');

  const isRetake = priorMit && priorMit.length > 0;
  const priorAttempts = (priorMit || []).map((r) => {
    const g = Array.isArray(r.mit_grades) ? r.mit_grades[0] : r.mit_grades;
    return {
      batch: r.batch?.batch_name || r.batch_id,
      status: (g?.status || 'NOT GRADED').toUpperCase(),
    };
  });

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
      membership_status: statusRaw,
      isRetake,
      priorAttempts,
    },
  });
}
