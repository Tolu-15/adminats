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


export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;


  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .select('*, batch:batches(*)')
    .eq('id', id)
    .single();

  if (sErr || !student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });


  const { data: membershipGrades } = await supabaseAdmin
    .from('student_grades')
    .select('*')
    .eq('student_id', id)
    .maybeSingle();


  const { data: mitReg } = await supabaseAdmin
    .from('mit_registrations')
    .select('*, batch:batches(*)')
    .eq('membership_student_id', id)
    .maybeSingle();

  let mitGradesData = null;
  if (mitReg) {
    const { data: mg } = await supabaseAdmin
      .from('mit_grades')
      .select('*')
      .eq('mit_registration_id', mitReg.id)
      .maybeSingle();
    mitGradesData = mg;
  }

  const mitRegistration = mitReg
    ? { ...mitReg, mit_grades: mitGradesData ? [mitGradesData] : [] }
    : null;

  // 4. Fetch Proclaimers registration + Proclaimers batch info
  const { data: procReg } = await supabaseAdmin
    .from('proclaimers_registrations')
    .select('*, batch:batches(*)')
    .eq('membership_student_id', id)
    .maybeSingle();

  let procGradesData = null;
  if (procReg) {
    const { data: pg } = await supabaseAdmin
      .from('proclaimers_grades')
      .select('*')
      .eq('proclaimers_registration_id', procReg.id)
      .maybeSingle();
    procGradesData = pg;
  }

  const proclaimersRegistration = procReg
    ? { ...procReg, proclaimers_grades: procGradesData ? [procGradesData] : [] }
    : null;

  return NextResponse.json({
    student,
    membershipGrades: membershipGrades || null,
    mitRegistration,
    proclaimersRegistration,
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
