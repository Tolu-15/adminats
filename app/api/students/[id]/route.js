import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export async function GET(request, { params }) {
  const { id } = await params;

  // 1. Fetch core student record + batch info
  const { data: rawStudent, error: sErr } = await supabaseAdmin
    .from('students')
    .select('*, batch:batches(*)')
    .eq('id', id)
    .single();

  if (sErr || !rawStudent) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // 2. Fetch Next of Kin & Spiritual Profile extension tables
  const [nokRes, spiritualRes, regsRes] = await Promise.all([
    supabaseAdmin.from('student_next_of_kin').select('*').eq('student_id', id).maybeSingle(),
    supabaseAdmin.from('student_spiritual_profile').select('*').eq('student_id', id).maybeSingle(),
    supabaseAdmin.from('registrations').select('*, batch:batches(*)').eq('student_id', id),
  ]);

  const nok = nokRes.data;
  const spiritual = spiritualRes.data;
  const registrations = regsRes.data || [];

  // Flatten biodata onto student object for seamless UI component compatibility
  const student = {
    ...rawStudent,
    next_of_kin: nok?.name || null,
    next_of_kin_relationship: nok?.relationship || null,
    next_of_kin_phone: nok?.phone || null,
    next_of_kin_address: nok?.address || null,
    born_again: spiritual?.born_again ? 'Yes' : (spiritual?.born_again === false ? 'No' : null),
    born_again_details: spiritual?.born_again_details || null,
    baptized_water: spiritual?.baptized_water,
    baptized_water_details: spiritual?.baptized_water_details || null,
    baptized_holy_spirit: spiritual?.baptized_holy_spirit,
    baptized_holy_spirit_details: spiritual?.baptized_holy_spirit_details || null,
    is_first_timer: spiritual?.is_first_timer ? 'Yes' : 'No',
  };

  // 3. Extract membership registration & grades
  const memReg = registrations.find((r) => r.stage === 'membership');
  let membershipGrades = null;
  if (memReg) {
    const { data: mg } = await supabaseAdmin
      .from('membership_grades')
      .select('*')
      .eq('registration_id', memReg.id)
      .maybeSingle();
    membershipGrades = mg;
  }

  if (!membershipGrades) {
    const { data: mg } = await supabaseAdmin
      .from('membership_grades')
      .select('*')
      .eq('student_id', id)
      .maybeSingle();
    membershipGrades = mg;
  }

  // 4. Extract MIT registration & grades
  const mitReg = registrations.find((r) => r.stage === 'mit');
  let mitGradesData = null;
  if (mitReg) {
    const { data: mg } = await supabaseAdmin
      .from('mit_grades')
      .select('*')
      .eq('registration_id', mitReg.id)
      .maybeSingle();
    mitGradesData = mg;
  }
  if (!mitGradesData) {
    const { data: mg } = await supabaseAdmin
      .from('mit_grades')
      .select('*')
      .eq('student_id', id)
      .maybeSingle();
    mitGradesData = mg;
  }

  const mitRegistration = mitReg
    ? { ...mitReg, mit_grades: mitGradesData ? [mitGradesData] : [] }
    : null;

  // 5. Extract Proclaimers registration & grades
  const procReg = registrations.find((r) => r.stage === 'proclaimers');
  let procGradesData = null;
  if (procReg) {
    const { data: pg } = await supabaseAdmin
      .from('proclaimers_grades')
      .select('*')
      .eq('registration_id', procReg.id)
      .maybeSingle();
    procGradesData = pg;
  }
  if (!procGradesData) {
    const { data: pg } = await supabaseAdmin
      .from('proclaimers_grades')
      .select('*')
      .eq('student_id', id)
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
 * Updates student biodata — updates students, student_next_of_kin, and student_spiritual_profile tables.
 */
export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // 1. Core student fields
  const studentFields = [
    'card_number', 'surname', 'first_name', 'middle_name', 'gender', 'date_of_birth',
    'email', 'phone', 'home_address', 'state_of_origin', 'local_government', 'nationality',
    'education', 'challenges', 'church_join_date', 'photo_url',
  ];

  const studentPayload = {};
  for (const field of studentFields) {
    if (field in body) studentPayload[field] = body[field] === '' ? null : body[field];
  }

  if (studentPayload.surname) studentPayload.surname = studentPayload.surname.toUpperCase().trim();
  if (studentPayload.first_name) studentPayload.first_name = studentPayload.first_name.toUpperCase().trim();
  if (studentPayload.middle_name) studentPayload.middle_name = studentPayload.middle_name.toUpperCase().trim();

  if (Object.keys(studentPayload).length > 0) {
    const { error: sErr } = await supabaseAdmin
      .from('students')
      .update(studentPayload)
      .eq('id', id);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  // 2. Next of Kin fields
  const nokFields = ['next_of_kin', 'next_of_kin_relationship', 'next_of_kin_phone', 'next_of_kin_address'];
  const hasNok = nokFields.some((f) => f in body);

  if (hasNok) {
    const nokPayload = {
      student_id: id,
      name: body.next_of_kin || null,
      relationship: body.next_of_kin_relationship || null,
      phone: body.next_of_kin_phone || null,
      address: body.next_of_kin_address || null,
    };
    await supabaseAdmin.from('student_next_of_kin').upsert(nokPayload);
  }

  // 3. Spiritual profile fields
  const spiritualFields = [
    'born_again', 'born_again_details', 'baptized_water', 'baptized_water_details',
    'baptized_holy_spirit', 'baptized_holy_spirit_details', 'is_first_timer',
  ];
  const hasSpiritual = spiritualFields.some((f) => f in body);

  if (hasSpiritual) {
    const spiritualPayload = {
      student_id: id,
      born_again: body.born_again === 'Yes' || body.born_again === true,
      born_again_details: body.born_again_details || null,
      baptized_water: body.baptized_water === 'Yes' || body.baptized_water === true,
      baptized_water_details: body.baptized_water_details || null,
      baptized_holy_spirit: body.baptized_holy_spirit === 'Yes' || body.baptized_holy_spirit === true,
      baptized_holy_spirit_details: body.baptized_holy_spirit_details || null,
      is_first_timer: body.is_first_timer === 'Yes' || body.is_first_timer === true,
    };
    await supabaseAdmin.from('student_spiritual_profile').upsert(spiritualPayload);
  }

  // Re-fetch updated full student record
  const { data: updatedStudent } = await supabaseAdmin
    .from('students')
    .select('*, batch:batches(*)')
    .eq('id', id)
    .single();

  return NextResponse.json({ student: updatedStudent });
}
