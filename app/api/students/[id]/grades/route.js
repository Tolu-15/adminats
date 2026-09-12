import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { logAdminAction } from '../../../../../lib/auditLog';

// Helper to get or create membership registration
async function getOrCreateMembershipReg(studentId) {
  let { data: reg } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', studentId)
    .eq('stage', 'membership')
    .maybeSingle();

  if (!reg) {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('batch_id')
      .eq('id', studentId)
      .single();

    if (student) {
      const { data: newReg } = await supabaseAdmin
        .from('registrations')
        .insert({
          student_id: studentId,
          batch_id: student.batch_id,
          stage: 'membership',
        })
        .select('id')
        .single();
      reg = newReg;
    }
  }

  return reg;
}

export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const reg = await getOrCreateMembershipReg(id);
  if (!reg) return NextResponse.json({ grades: null });

  const { data, error } = await supabaseAdmin
    .from('membership_grades')
    .select('*')
    .eq('registration_id', reg.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grades: data });
}

export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const reg = await getOrCreateMembershipReg(id);
  if (!reg) return NextResponse.json({ error: 'Membership registration not found.' }, { status: 404 });

  // Pre-fetch existing grade record to calculate exact diff
  const { data: existingGrade } = await supabaseAdmin
    .from('membership_grades')
    .select('*')
    .eq('registration_id', reg.id)
    .maybeSingle();

  const numericFields = ['attendance', 'test', 'assignment', 'assessment', 'presentation', 'exam', 'final_grades'];
  const gradeFields = [
    'class', 'trainer', 'attendance', 'test', 'assignment', 'assessment',
    'presentation', 'exam', 'final_grades', 'water_baptism', 'holy_spirit_baptism',
    'portal', 'status', 'comments', 'covenant_deed', 'id_card_collected_date',
  ];

  const payload = {
    registration_id: reg.id,
    updated_at: new Date().toISOString(),
  };

  const actuallyModifiedFields = [];
  const changes = {};

  for (const f of gradeFields) {
    if (f in body) {
      let val = body[f] === '' ? null : body[f];
      if (numericFields.includes(f) && val != null) {
        val = Number(val);
        if (isNaN(val)) val = null;
      }
      payload[f] = val;

      const oldVal = existingGrade ? existingGrade[f] : null;
      const normOld = oldVal == null || oldVal === '' ? null : String(oldVal).trim();
      const normNew = val == null || val === '' ? null : String(val).trim();

      if (normOld !== normNew) {
        actuallyModifiedFields.push(f);
        changes[f] = { from: oldVal ?? null, to: val ?? null };
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('membership_grades')
    .upsert(payload, { onConflict: 'registration_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch student info to record human-friendly name
  const { data: st } = await supabaseAdmin
    .from('students')
    .select('first_name, surname, student_unique_id')
    .eq('id', id)
    .maybeSingle();

  const studentName = st ? [st.first_name, st.surname].filter(Boolean).join(' ') : 'Student';

  let gradeSummary = '';
  if (actuallyModifiedFields.length === 0) {
    gradeSummary = `Re-saved membership grades for ${studentName} (no values changed)`;
  } else if (actuallyModifiedFields.length === 1) {
    const singleField = actuallyModifiedFields[0];
    const diff = changes[singleField];
    const fromStr = diff?.from != null ? `"${diff.from}"` : '(empty)';
    const toStr = diff?.to != null ? `"${diff.to}"` : '(cleared)';
    gradeSummary = `Updated ${singleField.replace(/_/g, ' ')} (${fromStr} → ${toStr}) for ${studentName}`;
  } else {
    gradeSummary = `Updated membership grades for ${studentName} (modified: ${actuallyModifiedFields.slice(0, 3).map((f) => f.replace(/_/g, ' ')).join(', ')}${actuallyModifiedFields.length > 3 ? ` +${actuallyModifiedFields.length - 3} more` : ''})`;
  }

  await logAdminAction({
    action: 'GRADE_UPDATE',
    entityType: 'grades',
    entityId: data?.id || reg.id,
    actor: user,
    details: {
      programme: 'membership',
      entity_name: studentName,
      student_id: id,
      student_unique_id: st?.student_unique_id || null,
      summary: gradeSummary,
      registration_id: reg.id,
      actually_modified_fields: actuallyModifiedFields,
      changes,
      final_grades: payload.final_grades ?? existingGrade?.final_grades ?? null,
      status: payload.status ?? existingGrade?.status ?? null,
    },
  });

  return NextResponse.json({ grades: data });
}
