import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import * as XLSX from 'xlsx';

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();
  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

  const wb = XLSX.utils.book_new();
  const safeCode = batch.batch_code.replace(/\s+/g, '_');

  // ── MIT BATCH ──────────────────────────────────────────────
  if (batch.programme_type === 'MIT') {
    const { data: regs, error: regErr } = await supabaseAdmin
      .from('mit_registrations')
      .select(`
        id, department,
        membership_student:students(surname, first_name, middle_name, student_unique_id, card_number),
        mit_grades(*)
      `)
      .eq('batch_id', id)
      .order('created_at', { ascending: true });

    if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

    const ws_data = [];

    // Row 1: MIT-203 header + BATCH label
    ws_data.push([
      'MIT-203', '', '', '', '', '', '', '', '', '', '',
      `BATCH ${batch.batch_code}`, '', '', '', '', '', '', '', '',
    ]);

    // Row 2: column headers (matching the grade sheet image exactly)
    ws_data.push([
      'STUDENT NAME',
      'STUDENT ID',
      'CARD NUMBER',
      'CLASS',
      'TRAINERS',
      'MIDTERM TEST',
      'INTERACTIONS',
      'BIBLE STUDY',
      'ASSIGNMENT',
      'ATTENDANCE',
      'CTH',
      'COMMUNITY SERVICE',
      'EVANGELISM',
      'PRESENTATION',
      'FINAL EXAM',
      'FINAL GRADES',
      'STATUS',
      'COMMENTS',
      'DEPARTMENT',
      'DEPARTMENT CONFIRMATION',
      'FIRST TIMER (YES/NO)',
      'FIRST TIMER DATE OF JOINING',
    ]);

    for (const reg of regs || []) {
      const s = reg.membership_student;
      const g = reg.mit_grades?.[0] ?? {};
      ws_data.push([
        `${s.surname} ${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''}`,
        s.student_unique_id,
        s.card_number ?? '',
        g.class ?? '',
        g.trainer ?? '',
        g.midterm_test ?? '',
        g.interactions ?? '',
        g.bible_study ?? '',
        g.assignment ?? '',
        g.attendance ?? '',
        g.cth ?? '',
        g.community_service ?? '',
        g.evangelism ?? '',
        g.presentation ?? '',
        g.final_exam ?? '',
        g.final_grades ?? '',
        g.status ?? '',
        g.comments ?? '',
        g.department ?? reg.department ?? '',
        g.department_confirmation ?? '',
        g.first_timer ?? '',
        g.first_timer_date ?? '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [
      { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 },
      { wch: 10 }, { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 24 },
      { wch: 20 }, { wch: 24 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 0, c: 11 }, e: { r: 0, c: 21 } },
    ];

    const fileName = `MIT-203_Batch_${safeCode}_Grades.xlsx`;
    XLSX.utils.book_append_sheet(wb, ws, `Batch ${batch.batch_code}`);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }

  // ── MEMBERSHIP BATCH (default) ──────────────────────────────
  const { data: students, error: studErr } = await supabaseAdmin
    .from('students')
    .select('*, student_grades(*)')
    .eq('batch_id', id)
    .order('created_at', { ascending: true });
  if (studErr) return NextResponse.json({ error: studErr.message }, { status: 500 });

  const ws_data = [];
  ws_data.push([
    'MEM-100', '', '', '', '', '', '', '', '',
    `BATCH ${batch.batch_code}`, '', '', '', '', '', '', '',
  ]);
  ws_data.push([
    'STUDENT NAME', 'STUDENT ID', 'CLASS', 'TRAINERS',
    'ATTENDANCE', 'TEST', 'ASSIGNMENT', 'ASSESSMENT', 'PRESENTATION',
    'EXAM', 'FINAL GRADES', 'WATER BAPTISM', 'HOLY SPIRIT BAPTISM',
    'PORTAL', 'STATUS', 'COMMENTS', 'COVENANT DEED',
  ]);

  for (const s of students || []) {
    const g = s.student_grades?.[0] ?? {};
    ws_data.push([
      `${s.surname} ${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''}`,
      s.student_unique_id,
      g.class ?? '', g.trainer ?? '',
      g.attendance ?? '', g.test ?? '', g.assignment ?? '', g.assessment ?? '',
      g.presentation ?? '', g.exam ?? '', g.final_grades ?? '',
      g.water_baptism ?? '', g.holy_spirit_baptism ?? '',
      g.portal ?? '', g.status ?? '', g.comments ?? '', g.covenant_deed ?? '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
    { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
    { wch: 24 }, { wch: 16 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 0, c: 9 }, e: { r: 0, c: 16 } },
  ];

  const fileName = `MEM-100_Batch_${safeCode}_Grades.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, `Batch ${batch.batch_code}`);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
