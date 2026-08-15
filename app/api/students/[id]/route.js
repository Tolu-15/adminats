import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

async function requireAdmin(request, allowViewer = false) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const role = data.user.user_metadata?.role || 'admin';
  if (!allowViewer && role === 'viewer') return null;
  return data.user;
}


export async function GET(request, { params }) {


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
 * Updates student biodata — all fields including photo, spiritual, kin, etc.
 */
export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await request.json();

  const allowed = [
    // Identity
    'card_number', 'surname', 'first_name', 'middle_name', 'gender', 'date_of_birth',
    // Contact & Origin
    'email', 'phone', 'home_address', 'state_of_origin', 'local_government', 'nationality',
    // Education & other
    'education', 'challenges', 'church_join_date',
    // Next of kin
    'next_of_kin', 'next_of_kin_relationship', 'next_of_kin_phone', 'next_of_kin_address',
    // Spiritual
    'born_again', 'born_again_details',
    'baptized_water', 'baptized_water_details',
    'baptized_holy_spirit', 'baptized_holy_spirit_details',
    'is_first_timer',
    // Photo
    'photo_url',
  ];

  const payload = {};
  for (const field of allowed) {
    if (field in body) {
      payload[field] = body[field] === '' ? null : body[field];
    }
  }

  // Coerce boolean fields
  if ('baptized_water' in payload) {
    payload.baptized_water = payload.baptized_water === 'Yes' || payload.baptized_water === true;
  }
  if ('baptized_holy_spirit' in payload) {
    payload.baptized_holy_spirit = payload.baptized_holy_spirit === 'Yes' || payload.baptized_holy_spirit === true;
  }

  let { data, error } = await supabaseAdmin
    .from('students')
    .update(payload)
    .eq('id', id)
    .select('*, batch:batches(*)')
    .single();

  if (error && (error.message?.includes('column') || error.code === 'PGRST204' || error.message?.includes('schema'))) {
    console.warn('Supabase DB missing new columns on update, retrying with fallback:', error.message);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.local_government;
    delete fallbackPayload.next_of_kin_relationship;
    delete fallbackPayload.next_of_kin_phone;

    const res2 = await supabaseAdmin
      .from('students')
      .update(fallbackPayload)
      .eq('id', id)
      .select('*, batch:batches(*)')
      .single();

    if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });
    data = res2.data;
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: data });
}

