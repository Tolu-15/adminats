import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * GET /api/proclaimers/registrations/[id]/grades
 */
export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const { data: reg, error } = await supabaseAdmin
    .from('proclaimers_registrations')
    .select(`
      *,
      membership_student:students(
        id, surname, first_name, middle_name, student_unique_id,
        card_number, phone, email, date_of_birth, gender, photo_url,
        church_join_date, home_address, state_of_origin, education
      )
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });

  const { data: pg } = await supabaseAdmin
    .from('proclaimers_grades')
    .select('*')
    .eq('proclaimers_registration_id', id)
    .maybeSingle();

  // Map database columns back to form fields if needed
  const mappedGrades = pg ? {
    ...pg,
    cih: pg.cih ?? pg.assignment ?? null,
    project: pg.project ?? pg.exam ?? null,
    mountain_of_influence: pg.mountain_of_influence ?? null,
    seminar_attendance: pg.seminar_attendance ?? null,
  } : null;

  const registration = {
    ...reg,
    proclaimers_grades: mappedGrades ? [mappedGrades] : [],
  };

  return NextResponse.json({ registration });
}

/**
 * PATCH /api/proclaimers/registrations/[id]/grades
 */
export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Exact columns existing in database table proclaimers_grades
  const DB_COLUMNS = [
    'class', 'trainer', 'attendance', 'assignment', 'assessment',
    'presentation', 'exam', 'final_grades', 'status', 'comments', 'department'
  ];

  const payload = {};
  for (const key of DB_COLUMNS) {
    if (key in body) {
      payload[key] = body[key] === '' ? null : body[key];
    }
  }

  // Clean fallback mapping for form fields if DB table has standard schema columns
  if ('cih' in body && !('assignment' in payload)) {
    payload.assignment = body.cih === '' ? null : body.cih;
  }
  if ('project' in body && !('exam' in payload)) {
    payload.exam = body.project === '' ? null : body.project;
  }

  payload.updated_at = new Date().toISOString();

  const { data: existingGrade } = await supabaseAdmin
    .from('proclaimers_grades')
    .select('id')
    .eq('proclaimers_registration_id', id)
    .maybeSingle();

  let dbError = null;
  if (existingGrade) {
    const { error } = await supabaseAdmin
      .from('proclaimers_grades')
      .update(payload)
      .eq('proclaimers_registration_id', id);
    dbError = error;
  } else {
    const { error } = await supabaseAdmin
      .from('proclaimers_grades')
      .insert({ proclaimers_registration_id: id, ...payload });
    dbError = error;
  }

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (payload.department !== undefined) {
    await supabaseAdmin
      .from('proclaimers_registrations')
      .update({ department: payload.department })
      .eq('id', id);
  }

  const { data: updatedGrade } = await supabaseAdmin
    .from('proclaimers_grades')
    .select('*')
    .eq('proclaimers_registration_id', id)
    .maybeSingle();

  return NextResponse.json(
    { success: true, grades: updatedGrade },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
