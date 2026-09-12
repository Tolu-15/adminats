import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';
import {
  isActiveBatchStudent,
  isActiveRegistration,
  registrationStudentKey,
} from '../../../../lib/activeAnalytics';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || 'ALL';

    // Fetch active batches independently of trash. Keeping this filter in the
    // database means a trashed batch cannot enter any dashboard calculation.
    const [{ data: activeBatches, error: batchErr }, trashedBatchCountRes, trashedStuCountRes] = await Promise.all([
      supabaseAdmin
        .from('batches')
        .select('id, batch_code, batch_name, programme_type, is_active, created_at, deleted_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('batches')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null),
      supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null),
    ]);

    if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

    const dashboardBatches = activeBatches || [];
    const activeBatchMap = new Map(dashboardBatches.map((b) => [b.id, b]));
    const trashedBatchesCount = trashedBatchCountRes?.count || 0;
    const trashedStudentsCount = trashedStuCountRes?.count || 0;

    // If a specific batch was requested, but it is in trash or non-existent:
    // NEVER use or compute analytics for a trashed batch!
    if (batchId !== 'ALL' && !activeBatchMap.has(batchId)) {
      return NextResponse.json({
        totalStudents: 0,
        membershipTotal: 0,
        mitTotal: 0,
        proclaimersTotal: 0,
        totalBatches: dashboardBatches.length,
        activeBatches: dashboardBatches.filter((b) => b.is_active !== false).length,
        trashedBatchesCount,
        trashedStudentsCount,
        selectedBatch: null,
        maleCount: 0,
        femaleCount: 0,
        malePercent: 0,
        femalePercent: 0,
        firstTimerCount: 0,
        regularCount: 0,
        firstTimerPercent: 0,
        batchDistribution: [],
        topDepartments: [],
        availableBatches: dashboardBatches.map((b) => ({
          id: b.id,
          name: b.batch_name,
          code: b.batch_code,
          programme: b.programme_type,
        })),
        isTrashed: true,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // Determine target batches: either a single active batch or all active non-trashed batches
    const isSingleBatch = batchId !== 'ALL' && activeBatchMap.has(batchId);
    const selectedBatch = isSingleBatch ? activeBatchMap.get(batchId) : null;
    const targetBatchIds = isSingleBatch
      ? [batchId]
      : dashboardBatches.map((b) => b.id);

    if (targetBatchIds.length === 0) {
      return NextResponse.json({
        totalStudents: 0,
        membershipTotal: 0,
        mitTotal: 0,
        proclaimersTotal: 0,
        totalBatches: dashboardBatches.length,
        activeBatches: dashboardBatches.filter((b) => b.is_active !== false).length,
        trashedBatchesCount,
        trashedStudentsCount,
        selectedBatch: null,
        maleCount: 0,
        femaleCount: 0,
        malePercent: 0,
        femalePercent: 0,
        firstTimerCount: 0,
        regularCount: 0,
        firstTimerPercent: 0,
        batchDistribution: [],
        topDepartments: [],
        availableBatches: dashboardBatches.map((b) => ({
          id: b.id,
          name: b.batch_name,
          code: b.batch_code,
          programme: b.programme_type,
        })),
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // 2. Fetch parallel counts & records scoped ONLY to non-trashed batches & non-trashed students
    const [stuRes, regsRes, spiritualRes] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, batch_id, gender, is_first_timer, created_at, deleted_at')
        .in('batch_id', targetBatchIds)
        .is('deleted_at', null),
      supabaseAdmin
        .from('registrations')
        .select(`
          id, batch_id, student_id, stage, department, created_at,
          student:students (
            id, batch_id, gender, is_first_timer, created_at, deleted_at
          )
        `)
        .in('batch_id', targetBatchIds),
      supabaseAdmin
        .from('student_spiritual_profile')
        .select('student_id, is_first_timer'),
    ]);

    // STRICT FILTER: Exclude any registration where the student is in trash,
    // where the registration's batch is in trash, or where the student's home batch is in trash
    const validRegs = (regsRes.data || []).filter((r) => isActiveRegistration(r, activeBatchMap));

    // Valid direct students (not in trash and belonging to non-trashed batches)
    const validDirectStudents = (stuRes.data || []).filter((s) => isActiveBatchStudent(s, activeBatchMap));

    // Direct students not already captured via registrations in their batch
    const registeredBatchStudentKeys = new Set(
      validRegs.map(registrationStudentKey).filter(Boolean)
    );
    const missingDirectStudents = validDirectStudents.filter(
      (s) => !registeredBatchStudentKeys.has(`${s.batch_id}_${s.id}`)
    );

    // Unique active students for accurate demographics (gender, first-timers)
    const activeStudentMap = new Map();
    validRegs.forEach((r) => {
      if (r.student && !activeStudentMap.has(r.student.id)) {
        activeStudentMap.set(r.student.id, r.student);
      }
    });
    missingDirectStudents.forEach((s) => {
      if (!activeStudentMap.has(s.id)) {
        activeStudentMap.set(s.id, s);
      }
    });

    // Map spiritual profile first timers only for verified active non-trashed students
    const spiritualFirstTimers = new Set(
      (spiritualRes.data || [])
        .filter((sp) => sp.is_first_timer && activeStudentMap.has(sp.student_id))
        .map((sp) => sp.student_id)
    );

    // Totals by programme (strictly non-trashed)
    const membershipRegsCount = validRegs.filter((r) => r.stage === 'membership').length;
    const membershipTotal = membershipRegsCount + missingDirectStudents.length;
    const mitTotal = validRegs.filter((r) => r.stage === 'mit').length;
    const proclaimersTotal = validRegs.filter((r) => r.stage === 'proclaimers').length;
    const totalStudents = membershipTotal + mitTotal + proclaimersTotal;

    const totalBatches = dashboardBatches.length;
    const activeBatchesCount = dashboardBatches.filter((b) => b.is_active !== false).length;

    // Gender breakdown for active non-trashed students in target batch(es)
    let maleCount = 0;
    let femaleCount = 0;
    activeStudentMap.forEach((s) => {
      const g = (s.gender || '').trim().toLowerCase();
      if (g === 'male') maleCount += 1;
      else if (g === 'female') femaleCount += 1;
    });
    const totalGender = maleCount + femaleCount;
    const malePercent = totalGender > 0 ? Math.round((maleCount / totalGender) * 100) : 0;
    const femalePercent = totalGender > 0 ? Math.round((femaleCount / totalGender) * 100) : 0;

    // First timers breakdown (strictly active non-trashed students)
    let firstTimerCount = 0;
    activeStudentMap.forEach((s) => {
      const isFT = s.is_first_timer === 'Yes' || s.is_first_timer === true || s.is_first_timer === 'true' || spiritualFirstTimers.has(s.id);
      if (isFT) firstTimerCount += 1;
    });
    const regularCount = Math.max(0, membershipTotal - firstTimerCount);
    const firstTimerPercent = membershipTotal > 0 ? Math.round((firstTimerCount / membershipTotal) * 100) : 0;

    // Batch distribution for growth chart (only active non-trashed batches)
    const batchesToDistribute = isSingleBatch ? [selectedBatch] : dashboardBatches.slice(0, 10);
    const batchDistribution = batchesToDistribute.map((b) => {
      const bRegs = validRegs.filter((r) => r.batch_id === b.id);
      const bDirect = missingDirectStudents.filter((s) => s.batch_id === b.id);
      const mem = bRegs.filter((r) => r.stage === 'membership').length + bDirect.length;
      const mit = bRegs.filter((r) => r.stage === 'mit').length;
      const proc = bRegs.filter((r) => r.stage === 'proclaimers').length;

      return {
        id: b.id,
        code: b.batch_code,
        name: b.batch_name,
        total: mem + mit + proc,
        mem,
        mit,
        proc,
      };
    });

    // Top departments (strictly active non-trashed registrations)
    const deptCounts = {};
    validRegs.forEach((r) => {
      const d = (r.department || '').trim();
      if (d && d !== '—' && d.toLowerCase() !== 'general') {
        deptCounts[d] = (deptCounts[d] || 0) + 1;
      }
    });

    const topDepartments = Object.entries(deptCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      totalStudents,
      membershipTotal,
      mitTotal,
      proclaimersTotal,
      totalBatches,
      activeBatches: activeBatchesCount,
      trashedBatchesCount,
      trashedStudentsCount,
      selectedBatch: selectedBatch ? {
        id: selectedBatch.id,
        name: selectedBatch.batch_name,
        code: selectedBatch.batch_code,
        programme: selectedBatch.programme_type,
        isActive: selectedBatch.is_active,
      } : null,
      maleCount,
      femaleCount,
      malePercent,
      femalePercent,
      firstTimerCount,
      regularCount,
      firstTimerPercent,
      batchDistribution,
      topDepartments,
      availableBatches: dashboardBatches.map((b) => ({
        id: b.id,
        name: b.batch_name,
        code: b.batch_code,
        programme: b.programme_type,
      })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch stats' }, { status: 500 });
  }
}
