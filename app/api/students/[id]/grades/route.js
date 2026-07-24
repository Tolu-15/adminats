import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

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
  const { data, error } = await supabaseAdmin
    .from('student_grades')
    .select('*')
    .eq('student_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grades: data });
}

export async function PATCH(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await request.json();

  const payload = {
    student_id:          id,
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
    updated_at:          new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('student_grades')
    .upsert(payload, { onConflict: 'student_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grades: data });
}
