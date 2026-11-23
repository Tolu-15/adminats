import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { canWrite } from '../../../../../lib/roles';
import { GRADE_FIELDS, validateGradeChanges } from '../../../../../lib/bulkGrades';
import { fetchAllPaginated, chunkedFetch } from '../../../../../lib/supabasePagination';
import { logAdminAction } from '../../../../../lib/auditLog';

export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const stage = new URL(request.url).searchParams.get('stage') || 'membership';
  if (!Object.hasOwn(GRADE_FIELDS, stage)) return NextResponse.json({ error: 'Invalid programme.' }, { status: 400 });
  try {
    const registrations = await fetchAllPaginated(() => supabaseAdmin.from('registrations').select('id, created_at, student_id, student:students(id, surname, first_name, student_unique_id, deleted_at), batch:batches(deleted_at)').eq('batch_id', id).eq('stage', stage).order('id'));
    const active = registrations.filter(row => row.student && !row.student.deleted_at && row.batch && !row.batch.deleted_at);
    const grades = await chunkedFetch(active.map(row => row.id), 200, async ids => {
      const { data, error } = await supabaseAdmin.from(stage + '_grades').select('*').in('registration_id', ids);
      if (error) throw error; return data;
    });
    const byRegistration = new Map(grades.map(grade => [grade.registration_id, grade]));
    return NextResponse.json({ rows: active.map(row => ({ registration_id: row.id, attempt_started_at: row.created_at, student: row.student, grades: byRegistration.get(row.id) || {} })) });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
export async function POST(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'This account is read-only.' }, { status: 403 });
  const { id } = await params;
  let body, rows;
  try {
    body = await request.json();
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 250) throw new Error('Save between 1 and 250 students at a time.');
    const ids = new Set();
    rows = body.rows.map(row => {
      if (!/^[a-f0-9-]{36}$/i.test(row.registration_id || '') || ids.has(row.registration_id)) throw new Error('Invalid or duplicate registration.');
      ids.add(row.registration_id);
      if (typeof row.attempt_started_at !== 'string' || !Number.isFinite(Date.parse(row.attempt_started_at))) throw new Error('Reload the class before saving.');
      return { registration_id: row.registration_id, attempt_started_at: row.attempt_started_at, expected: row.expected || {}, changes: validateGradeChanges(body.stage, row.changes) };
    });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  const { data, error } = await supabaseAdmin.rpc('save_bulk_grades', { p_batch_id: id, p_stage: body.stage, p_rows: rows });
  if (error) return NextResponse.json({ error: error.code === 'PGRST202' ? 'Bulk grading needs the retake_history_and_bulk_grading.sql migration. No grades were saved.' : error.message }, { status: error.code === 'P0001' ? 409 : 500 });
  await logAdminAction({ action: 'GRADE_UPDATE', entityType: 'batch', entityId: id, actor: user, details: { summary: 'Bulk grade update: ' + data + ' students', programme: body.stage, rows } });
  return NextResponse.json({ saved: data });
}
