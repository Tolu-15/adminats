import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { logAdminAction } from '../../../../lib/auditLog';

const CHUNK_SIZE = 100;
const PAGE_SIZE = 1000;

/**
 * Fetch all IDs matching a filter with pagination so batches with >1000 records
 * are not truncated by PostgREST's default limit.
 */
async function fetchAllIds(tableName, filterColumn, filterValue) {
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
async function fetchRegistrationsForStudents(studentIds) {
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
async function deleteInChunks(tableName, columnName, values) {
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
async function deleteWhereSafe(tableName, columnName, value) {
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
async function deleteLegacyProgrammeRows(tableName, gradesTableName, gradeColumnName, columnName, values) {
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

export async function DELETE(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();

    // Fetch batch name before deletion so we have it for the audit log
    const { data: bData } = await supabaseAdmin
      .from('batches')
      .select('batch_name, batch_code')
      .eq('id', id)
      .maybeSingle();

    const batchName = bData?.batch_name || 'Batch';

    // 1. Attempt soft-delete first if deleted_at column is available
    const { error: softErr } = await supabaseAdmin
      .from('batches')
      .update({ deleted_at: now })
      .eq('id', id);

    if (!softErr) {
      // Soft-delete students associated with this batch as well
      await supabaseAdmin
        .from('students')
        .update({ deleted_at: now })
        .eq('batch_id', id);

      await logAdminAction({
        action: 'BATCH_DELETE',
        entityType: 'batch',
        entityId: id,
        actor: user,
        details: {
          entity_name: batchName,
          batch_code: bData?.batch_code || null,
          summary: `Moved batch "${batchName}" to Trash`,
          mode: 'soft_delete',
        },
      });

      return NextResponse.json({ success: true, mode: 'soft_delete' });
    }

    // If soft-delete failed because deleted_at column doesn't exist (PGRST204/42703), proceed with cascade hard-delete
    if (softErr.code !== '42703' && softErr.code !== 'PGRST204') {
      return NextResponse.json({ error: softErr.message }, { status: 500 });
    }

    // 2. Fallback to full cascade hard-delete if database does not have soft-delete columns
    // 2a. Fetch all student IDs belonging to this batch (paginated to handle >1000 rows)
    const studentIds = await fetchAllIds('students', 'batch_id', id);

    // 2b. Fetch all registrations directly associated with this batch (paginated)
    const batchRegIds = await fetchAllIds('registrations', 'batch_id', id);

    // 2c. Fetch any registrations associated with these students (chunked to avoid URI limit)
    const studentRegIds = studentIds.length > 0 ? await fetchRegistrationsForStudents(studentIds) : [];

    // All unique registration IDs to clean up
    const registrationIds = Array.from(new Set([...batchRegIds, ...studentRegIds].filter(Boolean)));

    // 2d. Delete grade records linked to these registrations (chunked)
    if (registrationIds.length > 0) {
      await deleteInChunks('membership_grades', 'registration_id', registrationIds);
      await deleteInChunks('mit_grades', 'registration_id', registrationIds);
      await deleteInChunks('proclaimers_grades', 'registration_id', registrationIds);
    }

    // 2e. Delete registrations (directly by batch_id and any remaining by id in chunks)
    await deleteWhereSafe('registrations', 'batch_id', id);
    if (registrationIds.length > 0) {
      await deleteInChunks('registrations', 'id', registrationIds);
    }

    // 2f. Delete student sub-records (spiritual profile, next of kin, and any legacy grades by student_id)
    if (studentIds.length > 0) {
      await deleteInChunks('student_next_of_kin', 'student_id', studentIds);
      await deleteInChunks('student_spiritual_profile', 'student_id', studentIds);
      await deleteInChunks('membership_grades', 'student_id', studentIds); // safe if column doesn't exist
      await deleteLegacyProgrammeRows('mit_registrations', 'mit_grades', 'mit_registration_id', 'membership_student_id', studentIds);
      await deleteLegacyProgrammeRows('proclaimers_registrations', 'proclaimers_grades', 'proclaimers_registration_id', 'membership_student_id', studentIds);
    }

    // 2g. Delete students (first directly by batch_id, then any remaining by id)
    await deleteWhereSafe('students', 'batch_id', id);
    if (studentIds.length > 0) {
      await deleteInChunks('students', 'id', studentIds);
    }

    // 2h. Delete legacy programme registrations by batch_id and batch student sequences
    await deleteLegacyProgrammeRows('mit_registrations', 'mit_grades', 'mit_registration_id', 'batch_id', [id]);
    await deleteLegacyProgrammeRows('proclaimers_registrations', 'proclaimers_grades', 'proclaimers_registration_id', 'batch_id', [id]);
    await deleteWhereSafe('batch_student_sequences', 'batch_id', id);

    // 2i. Finally delete the batch itself
    const { error: batchDeleteError } = await supabaseAdmin
      .from('batches')
      .delete()
      .eq('id', id);

    if (batchDeleteError) {
      return NextResponse.json({ error: batchDeleteError.message }, { status: 500 });
    }

    await logAdminAction({
      action: 'BATCH_DELETE',
      entityType: 'batch',
      entityId: id,
      actor: user,
      details: {
        entity_name: batchName,
        batch_code: bData?.batch_code || null,
        summary: `Permanently deleted batch "${batchName}"`,
        mode: 'hard_delete',
      },
    });

    return NextResponse.json({ success: true, mode: 'hard_delete' });
  } catch (err) {
    console.error('Error deleting batch:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete batch' }, { status: 500 });
  }
}
