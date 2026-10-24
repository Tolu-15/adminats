import { gzipSync } from 'node:zlib';
import { fetchAllPaginated } from './supabasePagination.js';

// Legacy tables are skipped (and reported) if they don't exist in a given deployment.
export const BACKUP_TABLES = [
  'batches',
  'students',
  'registrations',
  'membership_grades',
  'mit_grades',
  'proclaimers_grades',
  'student_next_of_kin',
  'student_spiritual_profile',
  'batch_student_sequences',
  'audit_logs',
  'mit_registrations',
  'proclaimers_registrations',
];

// Stable ordering is required for correct range pagination; use whichever key the table has.
const ORDER_CANDIDATES = ['id', 'student_id', 'batch_id'];

async function exportTable(supabase, table) {
  let lastError = null;
  for (const orderBy of ORDER_CANDIDATES) {
    try {
      return await fetchAllPaginated(() => supabase.from(table).select('*').order(orderBy));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Exports every table to JSON. A missing or failed table is recorded, not fatal. */
export async function exportDatabase(supabase, tables = BACKUP_TABLES) {
  const data = {};
  const counts = {};
  const errors = {};

  for (const table of tables) {
    try {
      data[table] = await exportTable(supabase, table);
      counts[table] = data[table].length;
    } catch (err) {
      errors[table] = err?.message || String(err);
    }
  }

  return {
    manifest: { created_at: new Date().toISOString(), counts, errors },
    data,
  };
}

export function backupFileName(date = new Date()) {
  return `backup-${date.toISOString().slice(0, 10)}.json.gz`;
}

export function packBackup(payload) {
  return gzipSync(Buffer.from(JSON.stringify(payload)));
}
