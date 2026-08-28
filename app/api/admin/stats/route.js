import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Fetch batches
  const { data: allBatches, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type, is_active, created_at')
    .order('created_at', { ascending: true });

  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

  // 2. Fetch parallel counts & records
  const [
    stuRes,
    regsRes,
    maleRes, femaleRes,
    firstTimersRes,
    recentRes
  ] = await Promise.all([
    supabaseAdmin.from('students').select('id, batch_id, gender'),
    supabaseAdmin.from('registrations').select('id, batch_id, stage, department'),
    supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Male'),
    supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Female'),
    supabaseAdmin.from('student_spiritual_profile').select('*', { count: 'exact', head: true }).eq('is_first_timer', true),
    supabaseAdmin
      .from('students')
      .select('id, surname, first_name, student_unique_id, created_at, batch:batches(batch_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const allStudents = stuRes.data || [];
  const allRegs = regsRes.data || [];

  const membershipTotal = allRegs.filter((r) => r.stage === 'membership').length || allStudents.length;
  const mitTotal = allRegs.filter((r) => r.stage === 'mit').length;
  const proclaimersTotal = allRegs.filter((r) => r.stage === 'proclaimers').length;
  const totalStudents = membershipTotal + mitTotal + proclaimersTotal;

  const totalBatches = (allBatches || []).length;
  const activeBatches = (allBatches || []).filter((b) => b.is_active).length;

  // Gender Breakdown
  const maleCount = maleRes.count ?? 0;
  const femaleCount = femaleRes.count ?? 0;
  const totalGender = maleCount + femaleCount;
  const malePercent = totalGender > 0 ? Math.round((maleCount / totalGender) * 100) : 0;
  const femalePercent = totalGender > 0 ? Math.round((femaleCount / totalGender) * 100) : 0;

  // First Timers Breakdown
  const firstTimerCount = firstTimersRes.count ?? 0;
  const regularCount = Math.max(0, membershipTotal - firstTimerCount);
  const firstTimerPercent = membershipTotal > 0 ? Math.round((firstTimerCount / membershipTotal) * 100) : 0;

  // Batch distribution
  const batchDistribution = (allBatches || []).slice(0, 10).map((b) => {
    const batchRegs = allRegs.filter((r) => r.batch_id === b.id);
    const mem = batchRegs.filter((r) => r.stage === 'membership').length || allStudents.filter((s) => s.batch_id === b.id).length;
    const mit = batchRegs.filter((r) => r.stage === 'mit').length;
    const proc = batchRegs.filter((r) => r.stage === 'proclaimers').length;

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

  // Top Departments Distribution
  const deptCounts = {};
  allRegs.forEach((r) => {
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
    activeBatches,
    maleCount,
    femaleCount,
    malePercent,
    femalePercent,
    firstTimerCount,
    regularCount,
    firstTimerPercent,
    batchDistribution,
    topDepartments,
    recentStudents: recentRes.data || [],
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
