import { supabaseAdmin } from './supabaseAdmin';
export async function retakeHistoryReady() {
  const { data, error } = await supabaseAdmin.rpc('ats_workflow_features');
  return !error && data === true;
}
export const retakeMigrationMessage = 'Programme registration needs the retake_history_and_bulk_grading.sql migration. Existing grades have not been reset.';
export async function startProgrammeAttempt({ studentId, batchId, stage, previous, department = null }) {
  if (!await retakeHistoryReady()) return { error: { message: retakeMigrationMessage, code: 'MIGRATION_REQUIRED' } };
  return supabaseAdmin.rpc('start_programme_attempt', {
    p_student_id: studentId, p_batch_id: batchId, p_stage: stage,
    p_expected_registration_id: previous?.id || null,
    p_expected_batch_id: previous?.batch_id || null,
    p_department: department,
  });
}
