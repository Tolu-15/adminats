import { supabaseAdmin } from './supabaseAdmin';
import { fetchAllPaginated } from './supabasePagination';
import { duplicateReasons } from './duplicateStudents';
export async function findDuplicateStudents(candidate) {
  const students = await fetchAllPaginated(() => supabaseAdmin.from('students').select('id, student_unique_id, surname, first_name, email, phone, deleted_at').order('id'));
  return students.map(student => ({ ...student, reasons: duplicateReasons(candidate, student) })).filter(student => student.reasons.length);
}
