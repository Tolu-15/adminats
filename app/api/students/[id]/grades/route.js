import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';

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

  const payload = {
    registration_id:     reg.id,
    class:               body.class               || null,
    trainer:             body.trainer             || null,
    attendance:          body.attendance   != null ? Number(body.attendance)   : null,
    test:                body.test         != null ? Number(body.test)         : null,
    assignment:          body.assignment   != null ? Number(body.assignment)   : null,
    assessment:          body.assessment   != null ? Number(body.assessment)   : null,
    presentation:        body.presentation != null ? Number(body.presentation) : null,
    exam:                body.exam         != null ? Number(body.exam)         : null,
    final_grades:        body.final_grades != null ? Number(body.final_grades) : null,
    water_baptism:       body.water_baptism        || null,
    holy_spirit_baptism: body.holy_spirit_baptism  || null,
    portal:              body.portal               || null,
    status:              body.status               || null,
    comments:            body.comments             || null,
    covenant_deed:       body.covenant_deed        || null,
    id_card_collected_date: body.id_card_collected_date || null,
    updated_at:          new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('membership_grades')
    .upsert(payload, { onConflict: 'registration_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grades: data });
}
