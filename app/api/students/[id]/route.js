import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * GET /api/students/[id]
 * Returns full unified profile:
 * - Student biodata
 * - Membership batch & student_grades
 * - MIT registrations & mit_grades
 */
export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  // 1. Fetch student + membership batch
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .select('*, batch:batches(*)')
    .eq('id', id)
    .single();

  if (sErr || !student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // 2. Fetch membership grades
  const { data: membershipGrades } = await supabaseAdmin
    .from('student_grades')
    .select('*')
    .eq('student_id', id)
    .maybeSingle();

  // 3. Fetch MIT registration + grades + MIT batch info
  const { data: mitReg } = await supabaseAdmin
    .from('mit_registrations')
    .select('*, batch:batches(*), mit_grades(*)')
    .eq('membership_student_id', id)
    .maybeSingle();

  return NextResponse.json({
    student,
    membershipGrades: membershipGrades || null,
    mitRegistration: mitReg || null,
  });
}

/**
 * PATCH /api/students/[id]
 * Updates student biodata (e.g. card_number, surname, phone...)
 */
export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await request.json();

  const allowed = [
    'card_number', 'surname', 'first_name', 'middle_name',
    'email', 'phone', 'date_of_birth', 'gender', 'home_address',
    'state_of_origin', 'nationality', 'education', 'church_join_date'
  ];

  const payload = {};
  for (const field of allowed) {
    if (field in body) {
      payload[field] = body[field] === '' ? null : body[field];
    }
  }

  const { data, error } = await supabaseAdmin
    .from('students')
    .update(payload)
    .eq('id', id)
    .select('*, batch:batches(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ student: data });
}
