import { supabaseAdmin } from './supabaseAdmin';

const CHUNK_SIZE = 100;
const PAGE_SIZE = 1000;

/**
 * Fetch all IDs matching a filter with pagination so batches with >1000 records
 * are not truncated by PostgREST's default limit.
 */
export async function fetchAllIds(tableName, filterColumn, filterValue) {
  const ids = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq(filterColumn, filterValue)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (error.code === 'PGRST205') return []; // Table doesn't exist
      throw error;
    }
    if (!data || data.length === 0) break;
    ids.push(...data.map((r) => r.id));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

/**
 * Fetch registration IDs for students in chunks of CHUNK_SIZE to prevent
 * URL query string length overflow (400 Bad Request).
 */
export async function fetchRegistrationsForStudents(studentIds) {
  const regIds = [];
  for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
    const chunk = studentIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .select('id')
      .in('student_id', chunk);

    if (error) {
      if (error.code === 'PGRST205') return [];
      throw error;
    }
    if (data && data.length > 0) {
      regIds.push(...data.map((r) => r.id));
    }
  }
  return regIds;
}

/**
 * Delete rows in chunks of CHUNK_SIZE to avoid HTTP URL length limits (400 Bad Request)
 * and safely ignore missing tables (PGRST205) or missing columns (42703).
 */
export async function deleteInChunks(tableName, columnName, values) {
  const cleanValues = Array.from(new Set((values || []).filter(Boolean)));
  for (let i = 0; i < cleanValues.length; i += CHUNK_SIZE) {
    const chunk = cleanValues.slice(i, i + CHUNK_SIZE);
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .in(columnName, chunk);

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42703') {
        return null;
      }
      throw error;
    }
  }
  return null;
}

/**
 * Safely delete where single column equals value, ignoring missing tables/columns.
 */
export async function deleteWhereSafe(tableName, columnName, value) {
  const { error } = await supabaseAdmin
    .from(tableName)
    .delete()
    .eq(columnName, value);

  if (error && error.code !== 'PGRST205' && error.code !== '42703') {
    throw error;
  }
  return null;
}

/**
 * Clean legacy programme rows if tables exist.
 */
export async function deleteLegacyProgrammeRows(tableName, gradesTableName, gradeColumnName, columnName, values) {
  const cleanValues = Array.from(new Set((values || []).filter(Boolean)));
  if (cleanValues.length === 0) return;

  for (let i = 0; i < cleanValues.length; i += CHUNK_SIZE) {
    const chunk = cleanValues.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .in(columnName, chunk);

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42703') return;
      throw error;
    }

    const ids = (data || []).map((row) => row.id);
    if (ids.length > 0) {
      await deleteInChunks(gradesTableName, gradeColumnName, ids);
      await deleteInChunks(tableName, 'id', ids);
    }
  }
}

/**
 * Completely cascades and permanently deletes a batch, its students, registrations, and grades.
 */
export async function cascadeDeleteBatch(batchId) {
  // 1. Fetch student IDs belonging to this batch
  const studentIds = await fetchAllIds('students', 'batch_id', batchId);

  // 2. Fetch registrations directly associated with this batch
  const batchRegIds = await fetchAllIds('registrations', 'batch_id', batchId);

  // 3. Fetch any registrations associated with these students
  const studentRegIds = studentIds.length > 0 ? await fetchRegistrationsForStudents(studentIds) : [];
  const registrationIds = Array.from(new Set([...batchRegIds, ...studentRegIds].filter(Boolean)));

  // 4. Delete grades linked to registrations
  if (registrationIds.length > 0) {
    await deleteInChunks('membership_grades', 'registration_id', registrationIds);
    await deleteInChunks('mit_grades', 'registration_id', registrationIds);
    await deleteInChunks('proclaimers_grades', 'registration_id', registrationIds);
  }

  // 5. Delete registrations
  await deleteWhereSafe('registrations', 'batch_id', batchId);
  if (registrationIds.length > 0) {
    await deleteInChunks('registrations', 'id', registrationIds);
  }

  // 6. Delete student sub-records (spiritual profile, next of kin, legacy grades)
  if (studentIds.length > 0) {
    await deleteInChunks('student_next_of_kin', 'student_id', studentIds);
    await deleteInChunks('student_spiritual_profile', 'student_id', studentIds);
    await deleteInChunks('membership_grades', 'student_id', studentIds);
    await deleteLegacyProgrammeRows('mit_registrations', 'mit_grades', 'mit_registration_id', 'membership_student_id', studentIds);
    await deleteLegacyProgrammeRows('proclaimers_registrations', 'proclaimers_grades', 'proclaimers_registration_id', 'membership_student_id', studentIds);
  }

  // 7. Delete students
  await deleteWhereSafe('students', 'batch_id', batchId);
  if (studentIds.length > 0) {
    await deleteInChunks('students', 'id', studentIds);
  }

  // 8. Delete legacy programme registrations by batch_id and batch student sequences
  await deleteLegacyProgrammeRows('mit_registrations', 'mit_grades', 'mit_registration_id', 'batch_id', [batchId]);
  await deleteLegacyProgrammeRows('proclaimers_registrations', 'proclaimers_grades', 'proclaimers_registration_id', 'batch_id', [batchId]);
  await deleteWhereSafe('batch_student_sequences', 'batch_id', batchId);

  // 9. Delete batch record itself
  const { error: batchDelErr } = await supabaseAdmin
    .from('batches')
    .delete()
    .eq('id', batchId);

  if (batchDelErr) throw batchDelErr;
  return true;
}

/**
 * Safely cascades and permanently deletes a list of students and their associated data.
 */
export async function cascadeDeleteStudents(studentIds) {
  const cleanIds = Array.from(new Set((studentIds || []).filter(Boolean)));
  if (cleanIds.length === 0) return true;

  // 1. Fetch any registrations linked to these students
  const regIds = await fetchRegistrationsForStudents(cleanIds);
  if (regIds.length > 0) {
    await deleteInChunks('membership_grades', 'registration_id', regIds);
    await deleteInChunks('mit_grades', 'registration_id', regIds);
    await deleteInChunks('proclaimers_grades', 'registration_id', regIds);
    await deleteInChunks('registrations', 'id', regIds);
  }

  // 2. Delete student sub-records
  await deleteInChunks('student_spiritual_profile', 'student_id', cleanIds);
  await deleteInChunks('student_next_of_kin', 'student_id', cleanIds);
  await deleteInChunks('membership_grades', 'student_id', cleanIds);
  await deleteLegacyProgrammeRows('mit_registrations', 'mit_grades', 'mit_registration_id', 'membership_student_id', cleanIds);
  await deleteLegacyProgrammeRows('proclaimers_registrations', 'proclaimers_grades', 'proclaimers_registration_id', 'membership_student_id', cleanIds);

  // 3. Delete the students themselves
  await deleteInChunks('students', 'id', cleanIds);
  return true;
}

