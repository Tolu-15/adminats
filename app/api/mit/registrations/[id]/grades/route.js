import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

/**
 * GET /api/mit/registrations/[id]/grades
 * Returns the registration + grades for a given registration ID.
 */
export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: reg, error } = await supabaseAdmin
    .from('registrations')
    .select(`
      *,
      membership_student:students(
        id, surname, first_name, middle_name, student_unique_id,
        card_number, phone, email, date_of_birth, gender, photo_url,
        church_join_date, home_address, state_of_origin, education
      )
    `)
    .eq('id', id)
    .eq('stage', 'mit')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });

  const { data: mg } = await supabaseAdmin
    .from('mit_grades')
    .select('*')
    .eq('registration_id', id)
    .maybeSingle();

  const registration = {
    ...reg,
    mit_grades: mg ? [mg] : [],
  };

  return NextResponse.json({ registration });
}

/**
 * PATCH /api/mit/registrations/[id]/grades
 * Updates MIT grades for a registration.
 */
export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const allowed = [
    'class', 'trainer', 'midterm_test', 'interactions', 'bible_study',
    'assignment', 'attendance', 'cth', 'community_service', 'evangelism',
    'presentation', 'exam', 'final_exam', 'final_grades', 'status', 'comments',
    'department_confirmation', 'first_timer', 'first_timer_date',
  ];

  const payload = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key] === '' ? null : body[key];
  }
  // Allow exam / final_exam fallback mapping
  if ('exam' in body && !('final_exam' in payload)) {
    payload.final_exam = body.exam === '' ? null : Number(body.exam);
  }

  payload.updated_at = new Date().toISOString();

  // Upsert grade record linked to registration_id
  const { error: dbError } = await supabaseAdmin
    .from('mit_grades')
    .upsert({ registration_id: id, ...payload }, { onConflict: 'registration_id' });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Keep department synced in registrations table if updated
  if (body.department !== undefined) {
    await supabaseAdmin
      .from('registrations')
      .update({ department: body.department })
      .eq('id', id);
  }

  // Fetch updated grade record
  const { data: updatedGrade } = await supabaseAdmin
    .from('mit_grades')
    .select('*')
    .eq('registration_id', id)
    .maybeSingle();

  return NextResponse.json(
    { success: true, grades: updatedGrade },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
