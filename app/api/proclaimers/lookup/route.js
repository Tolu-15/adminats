import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * GET /api/proclaimers/lookup?q=ATS-055-0001
 *   or GET /api/proclaimers/lookup?q=CARD-12345
 *
 * Public route — checks that student:
 *  1) Exists in students table
 *  2) Has PASSED Membership (student_grades.status === 'PASSED')
 *  3) Has PASSED MIT (mit_registrations -> mit_grades.status === 'PASSED')
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ error: 'Query required.' }, { status: 400 });

  // 1. Search student by student_unique_id OR card_number
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
  const { data: membershipGrade } = await supabaseAdmin
    .from('student_grades')
    .select('status')
    .eq('student_id', student.id)
    .maybeSingle();

  const memStatus = (membershipGrade?.status || '').toString().trim().toUpperCase();
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

  // 3. Check MIT registration & MIT grade status
  const { data: mitRegs } = await supabaseAdmin
    .from('mit_registrations')
    .select(`
      id,
      mit_grades ( status )
    `)
    .eq('membership_student_id', student.id);

  if (!mitRegs || mitRegs.length === 0) {
    return NextResponse.json({
      error: 'This student has not completed MIT class and is not eligible for Proclaimers registration.',
      student: {
        name: `${student.first_name} ${student.surname}`,
        student_unique_id: student.student_unique_id,
        membership_status: 'PASSED',
        mit_status: 'NOT REGISTERED',
      },
    }, { status: 403 });
  }

  // Check if any MIT registration has passed
  const passedMit = mitRegs.some((reg) => {
    const grades = Array.isArray(reg.mit_grades) ? reg.mit_grades[0] : reg.mit_grades;
    return (grades?.status || '').toString().trim().toUpperCase() === 'PASSED';
  });

  if (!passedMit) {
    return NextResponse.json({
      error: 'This student has not passed MIT class and is not eligible for Proclaimers registration.',
      student: {
        name: `${student.first_name} ${student.surname}`,
        student_unique_id: student.student_unique_id,
        membership_status: 'PASSED',
        mit_status: 'NOT PASSED',
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
