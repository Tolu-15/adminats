import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import {
  dateOfBirthMatches,
  dateOfBirthMismatchResponse,
  dateOfBirthRequiredResponse,
} from '../../../../lib/studentVerification';

export async function GET(request) {
  const rawQ = (searchParams.get('q') || '').trim();
  const dateOfBirth = (searchParams.get('date_of_birth') || '').trim();
  if (!rawQ || !dateOfBirth) return NextResponse.json(dateOfBirthRequiredResponse(), { status: 400 });

  if (!/^[a-zA-Z0-9\-\/\s]+$/.test(rawQ)) {
    return NextResponse.json({ error: 'Invalid search format.' }, { status: 400 });
  }
  const q = rawQ.replace(/\s+/g, ' ');

  const studentFields = `
    id, student_unique_id, surname, first_name, middle_name,
    phone, email, date_of_birth, gender, card_number,
    church_join_date, batch_id
  `;

  let { data: student, error } = await supabaseAdmin
    .from('students')
    .select(studentFields)
    .eq('student_unique_id', q)
    .maybeSingle();

  if (!error && !student) {
    const cardRes = await supabaseAdmin
      .from('students')
      .select(studentFields)
      .eq('card_number', q)
      .maybeSingle();
    student = cardRes.data;
    error = cardRes.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: 'No student found with that ID or card number. Please check and try again.' }, { status: 404 });
  if (!dateOfBirthMatches(student.date_of_birth, dateOfBirth)) {
    return NextResponse.json(dateOfBirthMismatchResponse(), { status: 403 });
  }

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
