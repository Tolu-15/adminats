import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';

export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // 1. Fetch batch details
  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();

  // 2. Fetch all registrations for this batch
  const { data: registrations } = await supabaseAdmin
    .from('registrations')
    .select(`
      id, stage, department, created_at, student_id,
      student:students(*),
      batch:batches(*)
    `)
    .eq('batch_id', id)
    .order('created_at', { ascending: false });

  const regsList = registrations || [];

  // Group registrations by stage, ignoring soft-deleted students
  const memRegs = regsList.filter((r) => r.stage === 'membership' && !r.student?.deleted_at);
  const mitRegsList = regsList.filter((r) => r.stage === 'mit' && !r.student?.deleted_at);
  const procRegsList = regsList.filter((r) => r.stage === 'proclaimers' && !r.student?.deleted_at);

  // Also catch any students directly linked to batch_id in students table if not in registrations yet
  const { data: directStudents } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('batch_id', id);

  const studentIds = new Set(memRegs.map((r) => r.student_id));
  const missingStudents = (directStudents || []).filter((s) => !s.deleted_at && !studentIds.has(s.id));

  // Fetch extension tables for all students in batch
  const allStudentIds = [
    ...memRegs.map((r) => r.student_id),
    ...missingStudents.map((s) => s.id),
  ];

  let nokMap = new Map();
  let spiritualMap = new Map();

  if (allStudentIds.length > 0) {
    const [nokRes, spiritualRes] = await Promise.all([
      supabaseAdmin.from('student_next_of_kin').select('*').in('student_id', allStudentIds),
      supabaseAdmin.from('student_spiritual_profile').select('*').in('student_id', allStudentIds),
    ]);

    (nokRes.data || []).forEach((n) => nokMap.set(n.student_id, n));
    (spiritualRes.data || []).forEach((s) => spiritualMap.set(s.student_id, s));
  }

  const fetchGradesByRegistration = async (tableName, registrationIds) => {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean)));
    if (ids.length === 0) return new Map();

    const { data } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .in('registration_id', ids);

    const gradeMap = new Map();
    (data || []).forEach((grade) => {
      if (grade.registration_id) gradeMap.set(grade.registration_id, grade);
    });
    return gradeMap;
  };

  const [membershipGradeMap, mitGradeMap, procGradeMap] = await Promise.all([
    fetchGradesByRegistration('membership_grades', memRegs.map((r) => r.id)),
    fetchGradesByRegistration('mit_grades', mitRegsList.map((r) => r.id)),
    fetchGradesByRegistration('proclaimers_grades', procRegsList.map((r) => r.id)),
  ]);

  // Format Membership Students with flattened properties for StudentTable
  const studentsWithGrades = [
    ...memRegs.map((r) => ({ regId: r.id, student: r.student })),
    ...missingStudents.map((s) => ({ regId: null, student: s })),
  ].map(({ regId, student }) => {
      if (!student) return null;
      const nok = nokMap.get(student.id);
      const spiritual = spiritualMap.get(student.id);
      const grade = regId ? membershipGradeMap.get(regId) : null;

      return {
        ...student,
        next_of_kin: nok?.name || null,
        next_of_kin_relationship: nok?.relationship || null,
        next_of_kin_phone: nok?.phone || null,
        next_of_kin_address: nok?.address || null,
        born_again: spiritual?.born_again ? 'Yes' : (spiritual?.born_again === false ? 'No' : null),
        born_again_details: spiritual?.born_again_details || null,
        baptized_water: spiritual?.baptized_water,
        baptized_water_details: spiritual?.baptized_water_details || null,
        baptized_holy_spirit: spiritual?.baptized_holy_spirit,
        baptized_holy_spirit_details: spiritual?.baptized_holy_spirit_details || null,
        is_first_timer: spiritual?.is_first_timer ? 'Yes' : 'No',
        membership_grades: grade ? [grade] : [],
      };
    });

  // Format MIT registrations
  const mitRegsWithGrades = mitRegsList.map((reg) => {
      const grade = mitGradeMap.get(reg.id);
      return {
        id: reg.id,
        department: reg.department,
        created_at: reg.created_at,
        membership_student: reg.student,
        mit_grades: grade ? [grade] : [],
      };
    });

  // Format Proclaimers registrations
  const procRegsWithGrades = procRegsList.map((reg) => {
      const grade = procGradeMap.get(reg.id);
      return {
        id: reg.id,
        department: reg.department,
        created_at: reg.created_at,
        membership_student: reg.student,
        proclaimers_grades: grade ? [grade] : [],
      };
    });

  return NextResponse.json({
    batch,
    students: studentsWithGrades.filter(Boolean),
    mitRegs: mitRegsWithGrades,
    proclaimersRegs: procRegsWithGrades,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
