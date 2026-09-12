import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../lib/requireAdmin';
import { logAdminAction } from '../../../lib/auditLog';
import {
  isActiveBatchStudent,
  isActiveRegistration,
} from '../../../lib/activeAnalytics';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let { data, error } = await supabaseAdmin
    .from('batches')
    .select('*, students(count), mit_registrations(count), proclaimers_registrations(count)')
    .order('created_at', { ascending: false });

  if (error) {
    // If proclaimers_registrations relation doesn't exist yet in DB, fallback to selecting without it
    const fallback = await supabaseAdmin
      .from('batches')
      .select('*, students(count), mit_registrations(count)')
      .order('created_at', { ascending: false });

    if (fallback.error) {
      const fallbackBasic = await supabaseAdmin
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });
      data = fallbackBasic.data;
      error = fallbackBasic.error;
    } else {
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Exclude batches that are in trash (deleted_at is NOT null)
  const activeBatches = (data || []).filter((batch) => !batch.deleted_at);
  const batchIds = activeBatches.map((batch) => batch.id).filter(Boolean);

  if (batchIds.length > 0) {
    const [regsRes, directStudentsRes] = await Promise.all([
      supabaseAdmin
        .from('registrations')
        .select('batch_id, stage, student_id, student:students(id, batch_id, deleted_at)')
        .in('batch_id', batchIds),
      supabaseAdmin
        .from('students')
        .select('id, batch_id, deleted_at')
        .in('batch_id', batchIds)
        .is('deleted_at', null),
    ]);

    const activeBatchIdSet = new Set(batchIds);

    // STRICT: Only count registrations where the student is NOT soft-deleted
    // and neither registration batch nor student's home batch is in trash
    const validRegs = (regsRes.data || []).filter((reg) => isActiveRegistration(reg, activeBatchIdSet));
    const directStudents = (directStudentsRes.data || []).filter((s) => isActiveBatchStudent(s, activeBatchIdSet));

    const countsByBatch = new Map();
    const registeredStudentSetByBatch = new Map();

    validRegs.forEach((reg) => {
      const bId = reg.batch_id;
      const current = countsByBatch.get(bId) || { membership: 0, mit: 0, proclaimers: 0, total: 0 };
      if (reg.stage === 'membership') current.membership += 1;
      if (reg.stage === 'mit') current.mit += 1;
      if (reg.stage === 'proclaimers') current.proclaimers += 1;
      current.total += 1;
      countsByBatch.set(bId, current);

      if (!registeredStudentSetByBatch.has(bId)) {
        registeredStudentSetByBatch.set(bId, new Set());
      }
      if (reg.student_id) {
        registeredStudentSetByBatch.get(bId).add(reg.student_id);
      }
    });

    // Add direct students who are not in trash and not already in registrations
    directStudents.forEach((s) => {
      const bId = s.batch_id;
      const regSet = registeredStudentSetByBatch.get(bId);
      if (!regSet || !regSet.has(s.id)) {
        const current = countsByBatch.get(bId) || { membership: 0, mit: 0, proclaimers: 0, total: 0 };
        current.membership += 1;
        current.total += 1;
        countsByBatch.set(bId, current);
      }
    });

    activeBatches.forEach((batch) => {
      const counts = countsByBatch.get(batch.id) || { membership: 0, mit: 0, proclaimers: 0, total: 0 };
      batch.registration_counts = counts;
      batch.active_student_count = counts.total;
    });
  }

  return NextResponse.json({ batches: activeBatches });
}

export async function POST(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
