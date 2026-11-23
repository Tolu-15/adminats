import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { fetchAllPaginated } from '../../../../../lib/supabasePagination';
export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { data: student, error: studentError } = await supabaseAdmin.from('students').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
    if (studentError) throw studentError;
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    let history = [], migrationRequired = false;
    try { history = await fetchAllPaginated(() => supabaseAdmin.from('registration_attempt_history').select('*').eq('student_id', id).order('archived_at', { ascending: false }).order('id')); }
    catch (error) { if (['PGRST205', '42P01'].includes(error.code)) migrationRequired = true; else throw error; }
    const { data: registrations, error } = await supabaseAdmin.from('registrations').select('id, stage, department, created_at, batch_id, batch:batches(batch_name, batch_code)').eq('student_id', id);
    if (error) throw error;
    const current = await Promise.all((registrations || []).map(async registration => {
      if (!['membership', 'mit', 'proclaimers'].includes(registration.stage)) return null;
      const { data: grade, error } = await supabaseAdmin.from(registration.stage + '_grades').select('*').eq('registration_id', registration.id).maybeSingle();
      if (error) throw error;
      return { id: registration.id, stage: registration.stage, batch_name: registration.batch?.batch_name, batch_code: registration.batch?.batch_code, department: registration.department, started_at: registration.created_at, grades: grade || {}, current: true };
    }));
    return NextResponse.json({ attempts: [...current.filter(Boolean), ...history], migrationRequired });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
