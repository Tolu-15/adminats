import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { canWrite } from '../../../../../lib/roles';
import { logAdminAction } from '../../../../../lib/auditLog';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import {
  isActiveBatchStudent,
  isActiveRegistration,
} from '../../../../../lib/activeAnalytics';
import {
  fetchAllPaginated,
  chunkedFetch, 
} from '../../../../../lib/supabasePagination';

const registrationFields = `
  id, stage, department, created_at, student_id, batch_id,
  student:students(*),
  batch:batches(*)
`;

export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();

  if (!batch || batch.deleted_at) {
    return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
  }

  const rawRegistrations = await fetchAllPaginated(() =>
    supabaseAdmin
      .from('registrations')
      .select(registrationFields)
      .eq('batch_id', id)
      .order('id')
  );

  const { data: activeBatches, error: activeBatchError } = await supabaseAdmin
    .from('batches')
    .select('id')
    .is('deleted_at', null);

  if (activeBatchError) {
    return NextResponse.json({ error: activeBatchError.message }, { status: 500 });
  }

  const activeBatchIds = new Set((activeBatches || []).map((row) => row.id));
  const regsList = rawRegistrations.filter((reg) =>
    isActiveRegistration(reg, activeBatchIds)
  );
  const memRegs = regsList.filter((reg) => reg.stage === 'membership');

  const rawDirectStudents = await fetchAllPaginated(() =>
    supabaseAdmin
      .from('students')
      .select('*')
      .eq('batch_id', id)
      .order('id')
  );

  const membershipStudentIds = new Set(memRegs.map((reg) => reg.student_id));
  const missingStudents = rawDirectStudents.filter(
    (student) =>
      isActiveBatchStudent(student, activeBatchIds) &&
      !membershipStudentIds.has(student.id)
  );

  const allStudentIds = [
    ...membershipStudentIds,
    ...missingStudents.map((student) => student.id),
  ];

  // Look up the Membership cohort's later registrations across batches.
  const laterStageRegs = await chunkedFetch(allStudentIds, 200, (chunk) =>
    fetchAllPaginated(() =>
      supabaseAdmin
        .from('registrations')
        .select(registrationFields)
        .in('student_id', chunk)
        .in('stage', ['mit', 'proclaimers'])
        .order('id')
    )
  );

  // Include direct registrations and deduplicate by registration ID.
  const registrationsById = new Map(regsList.map((reg) => [reg.id, reg]));
  for (const reg of laterStageRegs) {
    if (isActiveRegistration(reg, activeBatchIds)) {
      registrationsById.set(reg.id, reg);
    }
  }

  const stageRegs = [...registrationsById.values()];
  const mitRegsList = stageRegs.filter((reg) => reg.stage === 'mit');
  const procRegsList = stageRegs.filter((reg) => reg.stage === 'proclaimers');

  const nokMap = new Map();
  const spiritualMap = new Map();

  if (allStudentIds.length > 0) {
    const [nokList, spiritualList] = await Promise.all([
      chunkedFetch(allStudentIds, 200, async (chunk) => {
        const { data } = await supabaseAdmin
          .from('student_next_of_kin')
          .select('*')
          .in('student_id', chunk);
        return data || [];
      }),
      chunkedFetch(allStudentIds, 200, async (chunk) => {
        const { data } = await supabaseAdmin
          .from('student_spiritual_profile')
          .select('*')
          .in('student_id', chunk);
        return data || [];
      }),
    ]);

    nokList.forEach((row) => nokMap.set(row.student_id, row));
    spiritualList.forEach((row) => spiritualMap.set(row.student_id, row));
  }

  const fetchGradesByRegistration = async (tableName, registrationIds) => {
    const ids = [...new Set(registrationIds.filter(Boolean))];
    if (ids.length === 0) return new Map();

    const gradeRows = await chunkedFetch(ids, 200, async (chunk) => {
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .in('registration_id', chunk);

      if (error) {
        console.error(`Error fetching grades from ${tableName}:`, error);
        return [];
      }

      return data || [];
    });

    const gradeMap = new Map();
    for (const grade of gradeRows) {
      if (grade.registration_id) {
        gradeMap.set(grade.registration_id, grade);
      }
    }
    return gradeMap;
  };

  const [membershipGradeMap, mitGradeMap, procGradeMap] = await Promise.all([
    fetchGradesByRegistration('membership_grades', memRegs.map((reg) => reg.id)),
    fetchGradesByRegistration('mit_grades', mitRegsList.map((reg) => reg.id)),
    fetchGradesByRegistration('proclaimers_grades', procRegsList.map((reg) => reg.id)),
  ]);

  const formattedStudents = [
    ...memRegs.map((reg) => ({ regId: reg.id, student: reg.student })),
    ...missingStudents.map((student) => ({ regId: null, student })),
  ]
    .map(({ regId, student }) => {
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
        born_again: spiritual?.born_again
          ? 'Yes'
          : (spiritual?.born_again === false ? 'No' : null),
        born_again_details: spiritual?.born_again_details || null,
        baptized_water: spiritual?.baptized_water,
        baptized_water_details: spiritual?.baptized_water_details || null,
        baptized_holy_spirit: spiritual?.baptized_holy_spirit,
        baptized_holy_spirit_details: spiritual?.baptized_holy_spirit_details || null,
        is_first_timer: spiritual?.is_first_timer ? 'Yes' : 'No',
        membership_grades: grade ? [grade] : [],
      };
    })
    .filter(Boolean);

  const mitRegsWithGrades = mitRegsList.map((reg) => {
    const grade = mitGradeMap.get(reg.id);
    return {
      id: reg.id,
      department: reg.department,
      created_at: reg.created_at,
      membership_student: reg.student,
      batch_id: reg.batch_id,
      batch: reg.batch,
      mit_grades: grade ? [grade] : [],
    };
  });

  const procRegsWithGrades = procRegsList.map((reg) => {
    const grade = procGradeMap.get(reg.id);
    return {
      id: reg.id,
      department: reg.department,
      created_at: reg.created_at,
      membership_student: reg.student,
      batch_id: reg.batch_id,
      batch: reg.batch,
      proclaimers_grades: grade ? [grade] : [],
    };
  });

  function sortStudents(a, b) {
    const nameA = `${a.surname || ''} ${a.first_name || ''}`.trim().toLowerCase();
    const nameB = `${b.surname || ''} ${b.first_name || ''}`.trim().toLowerCase();
    return nameA.localeCompare(nameB);
  }

  function sortRegs(a, b) {
    return sortStudents(a.membership_student || {}, b.membership_student || {});
  }

  return NextResponse.json(
    {
      batch,
      students: formattedStudents.sort(sortStudents),
      mitRegs: mitRegsWithGrades.sort(sortRegs),
      proclaimersRegs: procRegsWithGrades.sort(sortRegs),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canWrite(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { student_id, stage } = await request.json();

    if (!student_id || !['membership', 'mit', 'proclaimers'].includes(stage)) {
      return NextResponse.json(
        { error: 'Select a student and valid programme.' },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }
    if (batch.programme_type && batch.programme_type.toLowerCase() !== stage) {
      return NextResponse.json(
        { error: 'Programme must match the batch.' },
        { status: 400 }
      );
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', student_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('registrations')
      .select('id')
      .eq('student_id', student_id)
      .eq('stage', stage)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        { error: 'Student is already enrolled in this programme. Use the retake workflow to change batches.' },
        { status: 409 }
      );
    }

    if (stage !== 'membership') {
      const priorStages = stage === 'mit' ? ['membership'] : ['membership', 'mit'];

      for (const priorStage of priorStages) {
        const { data: prior, error: priorError } = await supabaseAdmin
          .from('registrations')
          .select('id')
          .eq('student_id', student_id)
          .eq('stage', priorStage)
          .maybeSingle();

        if (priorError) throw priorError;

        const { data: grade, error: gradeError } = prior
          ? await supabaseAdmin
              .from(priorStage + '_grades')
              .select('status')
              .eq('registration_id', prior.id)
              .maybeSingle()
          : { data: null };

        if (gradeError) throw gradeError;

        if ((grade?.status || '').trim().toUpperCase() !== 'PASSED') {
          return NextResponse.json(
            { error: 'Student must complete ' + priorStage.toUpperCase() + ' before this programme.' },
            { status: 400 }
          );
        }
      }
    }

    const { data: registration, error } = await supabaseAdmin
      .from('registrations')
      .insert({ student_id, batch_id: id, stage })
      .select()
      .single();

    if (error) {
      const duplicate = error.code === '23505';
      return NextResponse.json(
        { error: duplicate ? 'Student is already enrolled in this programme.' : error.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    const { error: gradeError } = await supabaseAdmin
      .from(stage + '_grades')
      .insert({ registration_id: registration.id });

    if (gradeError) {
      const { error: rollbackError } = await supabaseAdmin
        .from('registrations')
        .delete()
        .eq('id', registration.id);

      if (rollbackError) {
        console.error('Manual enrollment rollback failed:', rollbackError);
      }
      throw gradeError;
    }

    await logAdminAction({
      action: 'STUDENT_ENROLL',
      entityType: 'student',
      entityId: student_id,
      actor: user,
      details: { batch_id: id, stage },
    });

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Unable to add student.' },
      { status: 500 }
    );
  }
}