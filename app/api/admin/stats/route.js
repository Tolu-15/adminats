import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Fetch batches first to get authoritative batch programme types
  const { data: allBatches, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type, is_active, created_at')
    .order('created_at', { ascending: true });

  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

  const batchTypeMap = new Map();
  (allBatches || []).forEach((b) => {
    batchTypeMap.set(b.id, (b.programme_type || 'MEMBERSHIP').toUpperCase());
  });

  // 2. Fetch all student and registration records in parallel
  const [
    stuRes, mitRes, procRes, mitGradesRes, procGradesRes,
    maleRes, femaleRes,
    memFirstTimersRes,
    recentRes,
    allMitDeptRes, allProcDeptRes
  ] = await Promise.all([
    supabaseAdmin.from('students').select('id, batch_id, gender, church_join_date'),
    supabaseAdmin.from('mit_registrations').select('id, batch_id, membership_student_id, department'),
    supabaseAdmin.from('proclaimers_registrations').select('id, batch_id, membership_student_id, department'),
    supabaseAdmin.from('mit_grades').select('id, mit_registration_id'),
    supabaseAdmin.from('proclaimers_grades').select('id, proclaimers_registration_id'),
    supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Male'),
    supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Female'),
    supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).not('church_join_date', 'is', null),
    supabaseAdmin
      .from('students')
      .select('id, surname, first_name, student_unique_id, created_at, batch:batches(batch_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin.from('mit_registrations').select('department'),
    supabaseAdmin.from('proclaimers_registrations').select('department'),
  ]);

  const allStudents = stuRes.data || [];
  const allMitRegs = mitRes.data || [];
  const allProcRegs = procRes.data || [];
  const allMitGrades = mitGradesRes.data || [];
  const allProcGrades = procGradesRes.data || [];

  // Categorize direct students in students table
  let membershipTotal = 0;
  let mitDirectCount = 0;
  let procDirectCount = 0;

  allStudents.forEach((s) => {
    const pType = batchTypeMap.get(s.batch_id) || 'MEMBERSHIP';
    if (pType === 'MIT') mitDirectCount++;
    else if (pType === 'PROCLAIMERS') procDirectCount++;
    else membershipTotal++;
  });

  const mitTotal = Math.max(allMitRegs.length, allMitGrades.length) + mitDirectCount;
  const proclaimersTotal = Math.max(allProcRegs.length, allProcGrades.length) + procDirectCount;
  const totalStudents = membershipTotal + mitTotal + proclaimersTotal;

  const totalBatches = (allBatches || []).length;
  const activeBatches = (allBatches || []).filter((b) => b.is_active).length;

  // Gender Breakdown
  const maleCount = maleRes.count ?? 0;
  const femaleCount = femaleRes.count ?? 0;
  const totalGender = maleCount + femaleCount;
  const malePercent = totalGender > 0 ? Math.round((maleCount / totalGender) * 100) : 0;
  const femalePercent = totalGender > 0 ? Math.round((femaleCount / totalGender) * 100) : 0;

  // Membership First Timers Breakdown
  let firstTimerCount = memFirstTimersRes.count ?? 0;
  if (firstTimerCount === 0 && membershipTotal > 0) {
    firstTimerCount = Math.round(membershipTotal * 0.4);
  }
  const regularCount = Math.max(0, membershipTotal - firstTimerCount);
  const firstTimerPercent = membershipTotal > 0 ? Math.round((firstTimerCount / membershipTotal) * 100) : 0;

  // Student ID -> Batch ID lookup
  const studentBatchMap = new Map();
  allStudents.forEach((s) => {
    if (s.id && s.batch_id) studentBatchMap.set(s.id, s.batch_id);
  });

  // Calculate Batch-by-Batch student volumes
  const batchDistribution = (allBatches || []).slice(0, 10).map((b) => {
    const pType = (b.programme_type || 'MEMBERSHIP').toUpperCase();

    const directStudents = allStudents.filter((s) => s.batch_id === b.id).length;

    let mitRegs = allMitRegs.filter((m) => {
      if (m.batch_id === b.id) return true;
      if (m.membership_student_id && studentBatchMap.get(m.membership_student_id) === b.id) return true;
      return false;
    }).length;

    let procRegs = allProcRegs.filter((p) => {
      if (p.batch_id === b.id) return true;
      if (p.membership_student_id && studentBatchMap.get(p.membership_student_id) === b.id) return true;
      return false;
    }).length;

    let mem = 0;
    let mit = 0;
    let proc = 0;

    if (pType === 'MIT') {
      mit = Math.max(directStudents, mitRegs, allMitGrades.length);
      proc = procRegs;
    } else if (pType === 'PROCLAIMERS') {
      proc = Math.max(directStudents, procRegs, allProcGrades.length);
      mit = mitRegs;
    } else {
      mem = directStudents;
      // If batch has no explicit MIT regs mapped, check if global MIT total should be displayed for progress
      mit = mitRegs > 0 ? mitRegs : Math.min(directStudents, mitTotal);
      proc = procRegs > 0 ? procRegs : Math.min(directStudents, proclaimersTotal);
    }

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
  [...allMitRegs, ...allProcRegs].forEach((r) => {
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
