import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workbook = new ExcelJS.Workbook();

    // Shared header-row style helper
    function styleHeaderRow(row) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      row.alignment = { wrapText: true, vertical: 'middle' };
    }

    // ── 1. STUDENTS MASTER BIO SHEET ────────────────────────────────────────
    const wsBio = workbook.addWorksheet('Students');
    wsBio.columns = [
      { width: 10 }, { width: 22 }, { width: 30 }, { width: 10 }, { width: 14 }, { width: 16 },
      { width: 28 }, { width: 35 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 },
      { width: 14 }, { width: 26 }, { width: 26 }, { width: 22 }, { width: 22 }, { width: 22 },
      { width: 26 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 },
    ];

    const bioTitleRow = wsBio.addRow(['STUDENTS — Master Bio Data']);
    bioTitleRow.font = { bold: true, size: 13 };
    wsBio.mergeCells('A1:W1');

    const bioBatchRow = wsBio.addRow(['BATCH [CODE]. [MONTH, YEAR]']);
    bioBatchRow.font = { bold: true };
    wsBio.mergeCells('A2:W2');

    const bioHeaderRow = wsBio.addRow([
      'REG. NO.',
      'CHARTER MEMBERSHIP ID CARD No.',
      'NAMES',
      'GENDER',
      'DATE OF BIRTH',
      'PHONE NO.',
      'EMAIL',
      'RESIDENTIAL ADDRESS',
      'STATE OF RESIDENCE',
      'STATE OF ORIGIN',
      'HOME TOWN / LGA',
      'COUNTRY OF RESIDENCE',
      'NATIONALITY',
      'DEPARTMENT, MINISTRY OR UNIT',
      'PASSPORT PHOTOGRAPH UPLOADED',
      'COVENANT DEED SIGNED',
      'NEXT OF KIN NAME',
      'NEXT OF KIN PHONE NO.',
      'RELATIONSHIP WITH NEXT OF KIN',
      'CURRENT CLASS',
      '_MEM_RANK',
      '_MIT_RANK',
      '_PRO_RANK',
    ]);
    styleHeaderRow(bioHeaderRow);

    wsBio.addRow([
      '1', '2026056 10001', 'SAMPLE STUDENT ONE', 'FEMALE', '2008-03-14', '8000000001',
      'sample1@example.com', '1 Example Street, Lagos', 'LAGOS', 'OYO', 'IBADAN', 'NIGERIA',
      'NIGERIAN', '', 'YES', 'SIGNED', '', '', '', 'Membership', '1', '', '',
    ]);
    wsBio.addRow([
      '2', '2026056 10002', 'SAMPLE STUDENT TWO', 'MALE', '2007-11-02', '8000000002',
      'sample2@example.com', '2 Example Street, Lagos', 'LAGOS', 'OGUN', 'ABEOKUTA', 'NIGERIA',
      'NIGERIAN', '', 'YES', 'SIGNED', '', '', '', 'MIT', '', '1', '',
    ]);
    wsBio.addRow([
      '3', '2026056 10003', 'SAMPLE STUDENT THREE', 'FEMALE', '2006-06-21', '8000000003',
      'sample3@example.com', '3 Example Street, Lagos', 'LAGOS', 'LAGOS', 'EPE', 'NIGERIA',
      'NIGERIAN', 'MEDIA', 'YES', 'SIGNED', '', '', '', 'Proclaimers', '', '', '1',
    ]);

    // ── 2. MEMBERSHIP (MEM-100) SHEET ────────────────────────────────────────
    const wsMem = workbook.addWorksheet('Membership (MEM-100)');
    wsMem.columns = [
      { width: 24 }, { width: 30 }, { width: 10 }, { width: 20 },
      { width: 12 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 },
      { width: 10 }, { width: 14 }, { width: 16 }, { width: 20 },
      { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 }, { width: 14 }, { width: 22 }, { width: 28 },
    ];

    const memTitleRow = wsMem.addRow(['MEMBERSHIP — MEM-100 Class Records']);
    memTitleRow.font = { bold: true, size: 13 };
    wsMem.mergeCells('A1:T1');

    const memBatchRow = wsMem.addRow(['BATCH [CODE]. [MONTH, YEAR]']);
    memBatchRow.font = { bold: true };
    wsMem.mergeCells('A2:T2');

    const memHeaderRow = wsMem.addRow([
      'CHARTER MEMBERSHIP ID CARD No.',
      ' NAMES',
      'CLASS ',
      'TRAINERS',
      'ATTENDANCE',
      'TEST',
      'ASSIGNMENT',
      'ASSESSMENT',
      'PRESENTATION',
      'EXAM',
      'FINAL GRADES',
      'BAPTISM (WATER)',
      'BAPTISM (HOLY SPIRIT)',
      'PORTAL',
      'STATUS',
      'COVENANT DEED',
      'FIRST TIMER (YES/NO)',
      'DATE  JOINED',
      'ID CARD COLLECTED/DATE',
      'COMMENTS',
    ]);
    styleHeaderRow(memHeaderRow);

    wsMem.addRow([
      '', 'SAMPLE STUDENT ONE', '', 'Trainer Name',
      20, 15, 15, 40, 10, 35, 95, 'YES', 'YES', 'ACTIVE', 'PASSED', 'SIGNED', 'NO', '', '', 'Excellent',
    ]);
    wsMem.addRow([
      '', 'SAMPLE STUDENT TWO', '', 'Trainer Name',
      18, 12, 14, 38, 8, 30, 88, 'YES', 'NO', 'ACTIVE', 'PASSED', 'SIGNED', 'YES', '2026-01-15', '', '',
    ]);

    // ── 3. MIT (MIT-200) SHEET ───────────────────────────────────────────────
    const wsMit = workbook.addWorksheet('MIT (MIT-200)');
    wsMit.columns = [
      { width: 24 }, { width: 30 }, { width: 10 }, { width: 20 },
      { width: 14 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 12 },
      { width: 10 }, { width: 18 }, { width: 13 }, { width: 14 }, { width: 12 },
      { width: 14 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 28 },
    ];

    const mitTitleRow = wsMit.addRow(['MIT — MIT-200 Class Records']);
    mitTitleRow.font = { bold: true, size: 13 };
    wsMit.mergeCells('A1:U1');

    const mitBatchRow = wsMit.addRow(['BATCH [CODE]. [MONTH, YEAR]']);
    mitBatchRow.font = { bold: true };
    wsMit.mergeCells('A2:U2');

    const mitHeaderRow = wsMit.addRow([
      'CHARTER MEMBERSHIP ID CARD No.',
      ' NAMES',
      'CLASS ',
      'TRAINERS',
      'MIDTERM TEST',
      'INTERACTIONS',
      'BIBLE STUDY',
      'ASSIGNMENT',
      'ATTENDANCE',
      'CITH',
      'COMMUNITY SERVICE',
      'EVANGELISM',
      'PRESENTATION',
      'FINAL EXAM',
      'FINAL GRADES',
      'STATUS',
      'DEPARTMENT',
      'DEPT. CONFIRMATION',
      'FIRST TIMER (YES/NO)',
      'DATE  JOINED',
      'COMMENTS',
    ]);
    styleHeaderRow(mitHeaderRow);

    wsMit.addRow([
      '', 'SAMPLE STUDENT TWO', '', 'Trainer Name',
      20, 10, 10, 10, 10, 10, 10, 10, 10, 40, 90, 'PASSED', 'Ushering', 'YES', 'NO', '', 'Great dedication',
    ]);

    // ── 4. PROCLAIMERS (PRO-300) SHEET ───────────────────────────────────────
    const wsProc = workbook.addWorksheet('Proclaimers (PRO-300)');
    wsProc.columns = [
      { width: 24 }, { width: 30 }, { width: 10 }, { width: 20 },
      { width: 22 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 12 },
      { width: 18 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 28 },
    ];

    const procTitleRow = wsProc.addRow(['PROCLAIMERS — PRO-300 Class Records']);
    procTitleRow.font = { bold: true, size: 13 };
    wsProc.mergeCells('A1:Q1');

    const procBatchRow = wsProc.addRow(['BATCH [CODE]. [MONTH, YEAR]']);
    procBatchRow.font = { bold: true };
    wsProc.mergeCells('A2:Q2');

    const procHeaderRow = wsProc.addRow([
      'CHARTER MEMBERSHIP ID CARD No.',
      ' NAMES',
      'CLASS ',
      'TRAINERS',
      'DEPARTMENT/MINISTRY',
      'CITH',
      'ATTENDANCE',
      'ASSESSMENT',
      'PRESENTATION',
      'PROJECT',
      'MT.OF INFLUENCE',
      'SEMINAR ATTENDANCE',
      'FINAL GRADES',
      'STATUS (RELEASED)',
      'FIRST TIMER (YES/NO)',
      'DATE JOINED',
      'COMMENTS',
    ]);
    styleHeaderRow(procHeaderRow);

    wsProc.addRow([
      '', 'SAMPLE STUDENT THREE', '', 'Trainer Name',
      'Media', 10, 15, 15, 10, 40, 10, 10, 95, 'RELEASED', 'NO', '', 'Completed project',
    ]);

    const fileBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="ATS_Master_Migration_Template.xlsx"',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate template.' }, { status: 500 });
  }
}
