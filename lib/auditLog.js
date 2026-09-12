import { supabaseAdmin } from './supabaseAdmin';

/**
 * Records an entry into the audit_logs table.
 * Designed to be non-blocking and fail-safe: logs warnings on failure so admin
 * operations are never aborted if the audit table has not yet been migrated in Supabase.
 *
 * @param {object} params
 * @param {string} params.action - e.g. 'STUDENT_UPDATE', 'STUDENT_DELETE', 'BATCH_DELETE', 'GRADE_UPDATE'
 * @param {string} params.entityType - e.g. 'student', 'batch', 'grades'
 * @param {string|number} params.entityId - ID or unique identifier of the target entity
 * @param {object} [params.actor] - Supabase User object from requireAdmin (has id, email)
 * @param {object} [params.details] - Metadata dictionary describing the change
 * @param {string} [params.ip] - IP address of the client
 */
export async function logAdminAction({ action, entityType, entityId, actor, details = {}, ip = null }) {
  try {
    const payload = {
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      details,
      ip_address: ip,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('audit_logs').insert(payload);
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
      console.warn(`[AuditLog] Could not write audit log for ${action}:`, error.message);
    }
  } catch (err) {
    console.warn(`[AuditLog] Exception logging ${action}:`, err.message);
  }
}
