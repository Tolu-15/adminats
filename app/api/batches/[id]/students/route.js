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

  const [batchRes, studentsRes, mitRes, procRes] = await Promise.all([
    supabaseAdmin.from('batches').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('students')
      .select('*')
      .eq('batch_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('mit_registrations')
      .select(`
        id, department, created_at,
        membership_student:students(id, surname, first_name, middle_name, student_unique_id, card_number, photo_url, email, phone)
      `)
      .eq('batch_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('proclaimers_registrations')
      .select(`
        id, department, created_at,
        membership_student:students(id, surname, first_name, middle_name, student_unique_id, card_number, photo_url, email, phone)
      `)
      .eq('batch_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const rawStudents = studentsRes.data || [];
  const rawMitRegs = mitRes.data || [];
  const rawProcRegs = procRes.data || [];

  // Fetch each student's membership grades separately
  const studentsWithGrades = await Promise.all(
    rawStudents.map(async (student) => {
      const { data: grade } = await supabaseAdmin
        .from('student_grades')
        .select('*')
        .eq('student_id', student.id)
        .maybeSingle();

      return {
        ...student,
        student_grades: grade ? [grade] : [],
      };
    })
  );

  // Fetch each MIT registration's grades separately
  const mitRegsWithGrades = await Promise.all(
    rawMitRegs.map(async (reg) => {
      const { data: grade } = await supabaseAdmin
        .from('mit_grades')
        .select('*')
        .eq('mit_registration_id', reg.id)
        .maybeSingle();

      return {
        ...reg,
        mit_grades: grade ? [grade] : [],
      };
    })
  );

  // Fetch each Proclaimers registration's grades separately
  const procRegsWithGrades = await Promise.all(
    rawProcRegs.map(async (reg) => {
      const { data: grade } = await supabaseAdmin
        .from('proclaimers_grades')
        .select('*')
        .eq('proclaimers_registration_id', reg.id)
        .maybeSingle();

      return {
        ...reg,
        proclaimers_grades: grade ? [grade] : [],
      };
    })
  );

  return NextResponse.json({
    batch: batchRes.data,
    students: studentsWithGrades,
    mitRegs: mitRegsWithGrades,
    proclaimersRegs: procRegsWithGrades,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
