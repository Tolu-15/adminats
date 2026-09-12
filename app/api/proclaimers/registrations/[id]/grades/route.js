import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { logAdminAction } from '../../../../../../lib/auditLog';

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

  // Pre-fetch registration and student info
  const { data: reg } = await supabaseAdmin
    .from('registrations')
    .select('id, department, student_id, membership_student:students(id, first_name, surname, student_unique_id)')
    .eq('id', id)
    .maybeSingle();

  // Pre-fetch existing Proclaimers grades to calculate exact diff
  const { data: existingGrade } = await supabaseAdmin
    .from('proclaimers_grades')
    .select('*')
    .eq('registration_id', id)
    .maybeSingle();

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

  // Calculate field diffs
  const actuallyModifiedFields = [];
  const changes = {};

  for (const key of allowed) {
    if (key in payload) {
      const oldVal = existingGrade ? existingGrade[key] : null;
      const newVal = payload[key];
      const normOld = oldVal == null || oldVal === '' ? null : String(oldVal).trim();
      const normNew = newVal == null || newVal === '' ? null : String(newVal).trim();
      if (normOld !== normNew) {
        actuallyModifiedFields.push(key);
        changes[key] = { from: oldVal ?? null, to: newVal ?? null };
      }
    }
  }

  const { error: dbError } = await supabaseAdmin
    .from('proclaimers_grades')
    .upsert({ registration_id: id, ...payload }, { onConflict: 'registration_id' });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (body.department !== undefined) {
    const oldDept = reg?.department || null;
    const newDept = body.department || null;
    if (oldDept !== newDept) {
      actuallyModifiedFields.push('department');
      changes.department = { from: oldDept, to: newDept };
    }
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

  const st = reg?.membership_student;
  const studentName = st ? [st.first_name, st.surname].filter(Boolean).join(' ') : 'Student';

  let gradeSummary = '';
  if (actuallyModifiedFields.length === 0) {
    gradeSummary = `Re-saved Proclaimers grades for ${studentName} (no values changed)`;
  } else if (actuallyModifiedFields.length === 1) {
    const f = actuallyModifiedFields[0];
    const diff = changes[f];
    const fromStr = diff?.from != null ? `"${diff.from}"` : '(empty)';
    const toStr = diff?.to != null ? `"${diff.to}"` : '(cleared)';
    gradeSummary = `Updated Proclaimers ${f.replace(/_/g, ' ')} (${fromStr} → ${toStr}) for ${studentName}`;
  } else {
    gradeSummary = `Updated Proclaimers grades for ${studentName} (modified: ${actuallyModifiedFields.slice(0, 3).map((f) => f.replace(/_/g, ' ')).join(', ')}${actuallyModifiedFields.length > 3 ? ` +${actuallyModifiedFields.length - 3} more` : ''})`;
  }

  await logAdminAction({
    action: 'GRADE_UPDATE',
    entityType: 'grades',
    entityId: updatedGrade?.id || id,
    actor: user,
    details: {
      programme: 'proclaimers',
      entity_name: studentName,
      student_id: st?.id || reg?.student_id || null,
      student_unique_id: st?.student_unique_id || null,
      summary: gradeSummary,
      registration_id: id,
      actually_modified_fields: actuallyModifiedFields,
      changes,
      final_grades: updatedGrade?.final_grades ?? null,
      status: updatedGrade?.status ?? null,
    },
  });

  return NextResponse.json(
    { success: true, grades: updatedGrade },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
