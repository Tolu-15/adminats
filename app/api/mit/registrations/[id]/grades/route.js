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
 * GET /api/mit/registrations/[id]/grades
 * Returns the MIT registration + grades for a given registration ID.
 */
export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const { data, error } = await supabaseAdmin
    .from('mit_registrations')
    .select(`
      *,
      mit_grades(*),
      membership_student:students(
        id, surname, first_name, middle_name, student_unique_id,
        card_number, phone, email, date_of_birth, gender, photo_url,
        church_join_date, home_address, state_of_origin, education
      )
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });

  return NextResponse.json({ registration: data });
}

/**
 * PATCH /api/mit/registrations/[id]/grades
 * Updates MIT grades for a registration.
 */
export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const allowed = [
    'class', 'trainer', 'midterm_test', 'interactions', 'bible_study',
    'assignment', 'attendance', 'cth', 'community_service', 'evangelism',
    'presentation', 'final_exam', 'final_grades', 'status', 'comments',
    'department', 'department_confirmation', 'first_timer', 'first_timer_date',
  ];

  const payload = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key] === '' ? null : body[key];
  }
  payload.updated_at = new Date().toISOString();

  // Upsert on mit_registration_id
  const { error } = await supabaseAdmin
    .from('mit_grades')
    .upsert({ mit_registration_id: id, ...payload }, { onConflict: 'mit_registration_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
