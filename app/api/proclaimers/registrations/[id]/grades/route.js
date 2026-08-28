import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

/**
 * GET /api/proclaimers/registrations/[id]/grades
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
    .eq('stage', 'proclaimers')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });

  const { data: pg } = await supabaseAdmin
    .from('proclaimers_grades')
    .select('*')
    .eq('registration_id', id)
    .maybeSingle();

  const registration = {
    ...reg,
    proclaimers_grades: pg ? [pg] : [],
  };

  return NextResponse.json({ registration });
}

/**
 * PATCH /api/proclaimers/registrations/[id]/grades
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
    'class', 'trainer', 'cih', 'attendance', 'assessment', 'presentation',
    'project', 'seminar_attendance', 'final_grades', 'mountain_of_influence',
    'first_timer', 'first_timer_date', 'status', 'comments',
  ];

  const payload = {};
  for (const key of allowed) {
    if (key in body) {
      payload[key] = body[key] === '' ? null : body[key];
    }
  }

  payload.updated_at = new Date().toISOString();

  const { error: dbError } = await supabaseAdmin
    .from('proclaimers_grades')
    .upsert({ registration_id: id, ...payload }, { onConflict: 'registration_id' });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (body.department !== undefined) {
    await supabaseAdmin
      .from('registrations')
      .update({ department: body.department })
      .eq('id', id);
  }

  const { data: updatedGrade } = await supabaseAdmin
    .from('proclaimers_grades')
    .select('*')
    .eq('registration_id', id)
    .maybeSingle();

  return NextResponse.json(
    { success: true, grades: updatedGrade },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
