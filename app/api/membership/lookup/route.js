import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ error: 'Query required.' }, { status: 400 });

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select(`
      id, student_unique_id, surname, first_name, middle_name,
      phone, email, date_of_birth, gender, card_number,
      church_join_date, batch_id
    `)
    .or(`student_unique_id.eq.${q},card_number.eq.${q}`)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: 'No student found with that ID or card number. Please check and try again.' }, { status: 404 });

  // Get spiritual profile is_first_timer
  const { data: spiritual } = await supabaseAdmin
    .from('student_spiritual_profile')
    .select('is_first_timer')
    .eq('student_id', student.id)
    .maybeSingle();

  // Get membership registration & grade
  const { data: memReg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', student.id)
    .eq('stage', 'membership')
    .maybeSingle();

  let prevStatus = '';
  if (memReg) {
    const { data: grade } = await supabaseAdmin
      .from('membership_grades')
      .select('status, comments')
      .eq('registration_id', memReg.id)
      .maybeSingle();
    prevStatus = (grade?.status || '').toUpperCase();
  }

  if (prevStatus === 'PASSED') {
    return NextResponse.json({
      error: `${student.first_name} ${student.surname} has already PASSED Membership. They are eligible for MIT — please use the MIT registration link instead.`,
      student: {
        name: `${student.first_name} ${student.surname}`,
        student_unique_id: student.student_unique_id,
        status: 'PASSED',
      },
    }, { status: 409 });
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
      card_number: student.card_number,
      church_join_date: student.church_join_date,
      is_first_timer: spiritual?.is_first_timer ? 'Yes' : 'No',
      previousBatchId: student.batch_id,
      previousStatus: prevStatus || 'NOT GRADED',
      isRetake: true,
    },
  });
}
