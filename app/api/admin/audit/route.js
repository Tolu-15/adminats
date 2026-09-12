import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

/**
 * GET /api/admin/audit
 * Fetches paginated audit logs with optional filtering by action type and actor search.
 */
export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const offset = (page - 1) * limit;
    const action = searchParams.get('action');
    const search = searchParams.get('search')?.trim();

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action && action !== 'ALL') {
      query = query.eq('action', action);
    }

    if (search) {
      const sanitized = search.replace(/[,.()"]/g, ' ').trim();
      if (sanitized) {
        query = query.or(`actor_email.ilike.%${sanitized}%,entity_id.ilike.%${sanitized}%`);
      }
    }

    const { data, count, error } = await query;

    if (error) {
      // If table has not been created yet in Supabase SQL editor
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return NextResponse.json({
          logs: [],
          total: 0,
          page,
          limit,
          tableMissing: true,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Extract unique entity IDs to resolve real names for historical and current audit records
    const studentIds = new Set();
    const batchIds = new Set();

    (data || []).forEach((log) => {
      const details = log.details || {};
      if (log.entity_type === 'student' && log.entity_id) {
        studentIds.add(log.entity_id);
      } else if (log.entity_type === 'grades' && details.student_id) {
        studentIds.add(details.student_id);
      }
      if (log.entity_type === 'batch' && log.entity_id) {
        batchIds.add(log.entity_id);
      }
    });

    const studentMap = {};
    if (studentIds.size > 0) {
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, first_name, surname, student_unique_id')
        .in('id', Array.from(studentIds));

      (students || []).forEach((s) => {
        const fullName = [s.first_name, s.surname].filter(Boolean).join(' ').trim();
        studentMap[s.id] = {
          name: fullName || null,
          student_unique_id: s.student_unique_id || null,
        };
      });
    }

    const batchMap = {};
    if (batchIds.size > 0) {
      const { data: batches } = await supabaseAdmin
        .from('batches')
        .select('id, batch_name, batch_code')
        .in('id', Array.from(batchIds));

      (batches || []).forEach((b) => {
        batchMap[b.id] = {
          name: b.batch_name || null,
          batch_code: b.batch_code || null,
        };
      });
    }

    // Format logs with user-friendly entity_name and summary fallbacks
    const formattedLogs = (data || []).map((log) => {
      const details = { ...(log.details || {}) };
      let entityName = details.entity_name;

      if (log.entity_type === 'student') {
        const st = studentMap[log.entity_id];
        if (st?.name) {
          entityName = st.name;
        } else if (!entityName || entityName === 'Student') {
          entityName = st?.student_unique_id || details.student_unique_id
            ? `Student (${st?.student_unique_id || details.student_unique_id})`
            : (log.entity_id ? `Student #${log.entity_id.slice(0, 8)}` : 'Student');
        }
        if (st?.student_unique_id && !details.student_unique_id) {
          details.student_unique_id = st.student_unique_id;
        }
      } else if (log.entity_type === 'grades') {
        const studentId = details.student_id;
        const st = studentId ? studentMap[studentId] : null;
        if (st?.name) {
          entityName = st.name;
        } else if (!entityName || entityName === 'Student') {
          entityName = st?.student_unique_id || details.student_unique_id
            ? `Student (${st?.student_unique_id || details.student_unique_id})`
            : 'Student';
        }
        if (st?.student_unique_id && !details.student_unique_id) {
          details.student_unique_id = st.student_unique_id;
        }
      } else if (log.entity_type === 'batch') {
        const bt = batchMap[log.entity_id];
        if (bt?.name) {
          entityName = bt.name;
        } else if (!entityName || entityName === 'Batch') {
          entityName = bt?.batch_code || details.batch_code
            ? `Batch (${bt?.batch_code || details.batch_code})`
            : (log.entity_id ? `Batch #${log.entity_id.slice(0, 8)}` : 'Batch');
        }
        if (bt?.batch_code && !details.batch_code) {
          details.batch_code = bt.batch_code;
        }
      }

      if (!entityName || entityName === 'Student' || entityName === 'Batch') {
        entityName = log.entity_id;
      }

      let summary = details.summary;
      if (!summary || summary.includes('for Student') || summary.includes('student Student') || summary === 'Updated student profile') {
        const displayName = entityName || 'record';
        switch (log.action) {
          case 'STUDENT_UPDATE':
            summary = `Updated profile for ${displayName}`;
            break;
          case 'STUDENT_DELETE':
            summary = `Moved ${displayName} to Trash`;
            break;
          case 'STUDENT_RESTORE':
            summary = `Restored ${displayName} from Trash`;
            break;
          case 'BATCH_DELETE':
            summary = `Moved batch "${displayName}" to Trash`;
            break;
          case 'BATCH_RESTORE':
            summary = `Restored batch "${displayName}" from Trash`;
            break;
          case 'BATCH_CREATE':
            summary = `Created batch "${displayName}"`;
            break;
          case 'BATCH_IMPORT':
            summary = `Imported records into batch "${displayName}"`;
            break;
          case 'GRADE_UPDATE':
            summary = `Updated grades for ${displayName}${details.final_grades != null ? ` (Score: ${details.final_grades})` : ''}`;
            break;
          default:
            summary = `${log.action.replace(/_/g, ' ')} on ${displayName}`;
        }
      }

      return {
        ...log,
        entity_name: entityName,
        summary,
        details,
      };
    });

    return NextResponse.json({
      logs: formattedLogs,
      total: count || 0,
      page,
      limit,
      tableMissing: false,
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
