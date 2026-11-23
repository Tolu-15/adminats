import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../lib/requireAdmin';
import { canWrite } from '../../../lib/roles';
import { logAdminAction } from '../../../lib/auditLog';
import {
  buildBatchCounts,
} from '../../../lib/activeAnalytics';

import { fetchAllPaginated } from '../../../lib/supabasePagination';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin.from('batches').select('*').order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Exclude batches that are in trash (deleted_at is NOT null)
  const activeBatches = (data || []).filter((batch) => !batch.deleted_at);
  const batchIds = activeBatches.map((batch) => batch.id).filter(Boolean);

  if (batchIds.length > 0) {
    const [rawRegs, rawDirectStudents] = await Promise.all([
      fetchAllPaginated(() =>
        supabaseAdmin
          .from('registrations')
          .select('id, batch_id, stage, student_id, student:students(id, batch_id, deleted_at)')
          .order('id')
          .in('batch_id', batchIds)
      ),
      fetchAllPaginated(() =>
        supabaseAdmin
          .from('students')
          .select('id, batch_id, deleted_at')
          .order('id')
          .in('batch_id', batchIds)
          .is('deleted_at', null)
      ),
    ]);

    const countsByBatch = buildBatchCounts(activeBatches, rawRegs || [], rawDirectStudents || []);
    activeBatches.forEach(batch => {
      batch.registration_counts = countsByBatch.get(batch.id);
      batch.active_student_count = batch.registration_counts.total;
    });
  }

  return NextResponse.json({ batches: activeBatches });
}

export async function POST(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Forbidden: this account is read-only.' }, { status: 403 });

  const body = await request.json();
  if (!body.batch_name) {
    return NextResponse.json({ error: 'Batch name is required.' }, { status: 400 });
  }

  const batch_name = body.batch_name.trim();
  const batch_code = body.batch_code ? body.batch_code.trim() : batch_name;
  const slug = batch_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  const reg_token = `${slug}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
  const programme_type = ['MEMBERSHIP', 'MIT', 'PROCLAIMERS'].includes(body.programme_type)
    ? body.programme_type
    : 'MEMBERSHIP';

  const { data, error } = await supabaseAdmin
    .from('batches')
    .insert({ batch_code, batch_name, reg_token, programme_type })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    action: 'BATCH_CREATE',
    entityType: 'batch',
    entityId: data.id,
    actor: user,
    details: {
      entity_name: data.batch_name,
      batch_code: data.batch_code,
      programme_type: data.programme_type,
      summary: `Created ${data.programme_type} batch "${data.batch_name}" (${data.batch_code})`,
    },
  });

  return NextResponse.json({ batch: data });
}
