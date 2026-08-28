import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import ExcelJS from 'exceljs';
import { requireAdmin } from '../../../../../lib/requireAdmin';

export async function GET(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();
  if (batchErr || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

  const workbook = new ExcelJS.Workbook();
  const safeCode = (batch.batch_name || 'Batch').replace(/\s+/g, '_');

  // Fetch all registrations in this batch
  const { data: registrations } = await supabaseAdmin
    .from('registrations')
    .select(`
      id, stage, department, student_id,
      student:students(surname, first_name, middle_name, student_unique_id, card_number)
    `)
    .eq('batch_id', id)
    .order('created_at', { ascending: true });

  const regsList = registrations || [];

  // Helper to add a styled header row
  function addHeaderRow(ws, columns, titleText) {
    // Title row
    const titleRow = ws.addRow([titleText]);
    titleRow.font = { bold: true, size: 13 };
    ws.mergeCells(`A1:${String.fromCharCode(64 + columns.length)}1`);

    // Batch name row
    const batchRow = ws.addRow([(batch.batch_name || '').toUpperCase()]);
    batchRow.font = { bold: true };
    ws.mergeCells(`A2:${String.fromCharCode(64 + columns.length)}2`);

    // Column header row
    const headerRow = ws.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    headerRow.alignment = { wrapText: true };
  }

  // ── 1. MEMBERSHIP STUDENTS SHEET ──────────────────────────────────────────
  const memRegs = regsList.filter((r) => r.stage === 'membership');
  if (memRegs.length > 0) {
    const memGradesList = await Promise.all(
      memRegs.map(async (r) => {
        const { data: g } = await supabaseAdmin
          .from('membership_grades')
          .select('*')
          .eq('registration_id', r.id)
          .maybeSingle();
        return { student: r.student, grade: g || {} };
      })
    );

    const ws = workbook.addWorksheet('Membership');
    const columns = [
      'STUDENT NAME', 'STUDENT ID', 'CHARTER MEMBERSHIP ID CARD No.', 'CLASS', 'TRAINERS',
      'ATTENDANCE', 'TEST', 'ASSIGNMENT', 'ASSESSMENT', 'PRESENTATION',
      'EXAM', 'FINAL GRADES', 'WATER BAPTISM', 'HOLY SPIRIT BAPTISM',
      'PORTAL', 'STATUS', 'COMMENTS', 'COVENANT DEED', 'ID CARD COLLECTED DATE',
    ];
    addHeaderRow(ws, columns, 'MEMBERSHIP GRADES');

    ws.columns = [
      { width: 28 }, { width: 18 }, { width: 22 }, { width: 10 }, { width: 20 },
      { width: 12 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 16 },
      { width: 10 }, { width: 14 }, { width: 16 }, { width: 20 },
      { width: 14 }, { width: 12 }, { width: 24 }, { width: 16 }, { width: 24 },
    ];

    for (const { student: s, grade: g } of memGradesList) {
      if (!s) continue;
      ws.addRow([
        `${s.surname} ${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''}`,
        s.student_unique_id,
        s.card_number ?? '',
        g.class ?? '', g.trainer ?? '',
        g.attendance ?? '', g.test ?? '', g.assignment ?? '', g.assessment ?? '',
        g.presentation ?? '', g.exam ?? '', g.final_grades ?? '',
        g.water_baptism ?? '', g.holy_spirit_baptism ?? '',
        g.portal ?? '', g.status ?? '', g.comments ?? '', g.covenant_deed ?? '',
        g.id_card_collected_date ?? '',
      ]);
    }
  }

  // ── 2. MIT STUDENTS SHEET ──────────────────────────────────────────────────
  const mitRegs = regsList.filter((r) => r.stage === 'mit');
  if (mitRegs.length > 0) {
    const mitGradesList = await Promise.all(
      mitRegs.map(async (reg) => {
        const { data: g } = await supabaseAdmin
          .from('mit_grades')
          .select('*')
          .eq('registration_id', reg.id)
          .maybeSingle();
        return { reg, grade: g || {} };
      })
    );

    const ws = workbook.addWorksheet('MIT');
    const columns = [
      'STUDENT NAME', 'STUDENT ID', 'CHARTER MEMBERSHIP ID CARD No.', 'CLASS', 'TRAINERS',
      'MIDTERM TEST', 'INTERACTIONS', 'BIBLE STUDY', 'ASSIGNMENT', 'ATTENDANCE',
      'CTH', 'COMMUNITY SERVICE', 'EVANGELISM', 'PRESENTATION', 'FINAL EXAM',
      'FINAL GRADES', 'STATUS', 'COMMENTS', 'DEPARTMENT', 'DEPARTMENT CONFIRMATION',
      'FIRST TIMER (YES/NO)', 'FIRST TIMER DATE OF JOINING',
    ];
    addHeaderRow(ws, columns, 'MIT GRADES');

    ws.columns = [
      { width: 28 }, { width: 16 }, { width: 22 }, { width: 8 }, { width: 20 },
      { width: 14 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 12 },
      { width: 10 }, { width: 18 }, { width: 13 }, { width: 14 }, { width: 12 },
      { width: 14 }, { width: 12 }, { width: 24 }, { width: 18 }, { width: 24 },
      { width: 20 }, { width: 24 },
    ];

    for (const { reg, grade: g } of mitGradesList) {
      const s = reg.student || {};
      ws.addRow([
        `${s.surname || ''} ${s.first_name || ''}${s.middle_name ? ' ' + s.middle_name : ''}`,
        s.student_unique_id || '',
        s.card_number ?? '',
        g.class ?? '', g.trainer ?? '',
        g.midterm_test ?? '', g.interactions ?? '', g.bible_study ?? '',
        g.assignment ?? '', g.attendance ?? '', g.cth ?? '',
        g.community_service ?? '', g.evangelism ?? '', g.presentation ?? '',
        g.final_exam ?? '', g.final_grades ?? '', g.status ?? '',
        g.comments ?? '', reg.department ?? '',
        g.department_confirmation ?? '', g.first_timer ?? '',
        g.first_timer_date ?? '',
      ]);
    }
  }

  // ── 3. PROCLAIMERS STUDENTS SHEET ──────────────────────────────────────────
  const procRegs = regsList.filter((r) => r.stage === 'proclaimers');
  if (procRegs.length > 0) {
    const procGradesList = await Promise.all(
      procRegs.map(async (reg) => {
        const { data: g } = await supabaseAdmin
          .from('proclaimers_grades')
          .select('*')
          .eq('registration_id', reg.id)
          .maybeSingle();
        return { reg, grade: g || {} };
      })
    );

    const ws = workbook.addWorksheet('Proclaimers');
    const columns = [
      'STUDENT NAME', 'STUDENT ID', 'CLASS', 'TRAINER',
      'CIH', 'ATTENDANCE', 'ASSESSMENT', 'PRESENTATION', 'PROJECT',
      'MOUNTAIN OF INFLUENCE', 'SEMINAR ATTENDANCE', 'FINAL GRADES',
      'STATUS (RELEASED)', 'COMMENTS', 'DEPARTMENT',
    ];
    addHeaderRow(ws, columns, 'PROCLAIMERS GRADES');

    ws.columns = [
      { width: 28 }, { width: 18 }, { width: 10 }, { width: 20 },
      { width: 10 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 12 },
      { width: 22 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 24 }, { width: 18 },
    ];

    for (const { reg, grade: g } of procGradesList) {
      const s = reg.student || {};
      ws.addRow([
        `${s.surname || ''} ${s.first_name || ''}${s.middle_name ? ' ' + s.middle_name : ''}`,
        s.student_unique_id || '',
        g.class ?? '', g.trainer ?? '',
        g.cih ?? '', g.attendance ?? '', g.assessment ?? '',
        g.presentation ?? '', g.project ?? '',
        g.mountain_of_influence ?? '', g.seminar_attendance ?? '',
        g.final_grades ?? '', g.status ?? '', g.comments ?? '',
        reg.department ?? '',
      ]);
    }
  }

  // Fallback if batch has no students in any category
  if (workbook.worksheets.length === 0) {
    const ws = workbook.addWorksheet('Summary');
    ws.addRow(['No registrations found for this batch.']);
  }

  const fileName = `Batch_${safeCode}_Grades.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
