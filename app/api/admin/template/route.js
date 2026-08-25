import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const wb = XLSX.utils.book_new();

    // ── 1. STUDENTS MASTER BIO SHEET ────────────────────────────────────────
    // Row 1: Title, Row 2: Batch, Row 3: Header (matches ATS TEMPLATE.xlsx exactly)
    const bioData = [
      ['STUDENTS — Master Bio Data'],
      ['BATCH [CODE]. [MONTH, YEAR]'],
      [
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
      ],
      [
        '1', '2026056 10001', 'SAMPLE STUDENT ONE', 'FEMALE', '2008-03-14', '8000000001',
        'sample1@example.com', '1 Example Street, Lagos', 'LAGOS', 'OYO', 'IBADAN', 'NIGERIA',
        'NIGERIAN', '', 'YES', 'SIGNED', '', '', '', 'Membership', '1', '', '',
      ],
      [
        '2', '2026056 10002', 'SAMPLE STUDENT TWO', 'MALE', '2007-11-02', '8000000002',
        'sample2@example.com', '2 Example Street, Lagos', 'LAGOS', 'OGUN', 'ABEOKUTA', 'NIGERIA',
        'NIGERIAN', '', 'YES', 'SIGNED', '', '', '', 'MIT', '', '1', '',
      ],
      [
        '3', '2026056 10003', 'SAMPLE STUDENT THREE', 'FEMALE', '2006-06-21', '8000000003',
        'sample3@example.com', '3 Example Street, Lagos', 'LAGOS', 'LAGOS', 'EPE', 'NIGERIA',
        'NIGERIAN', 'MEDIA', 'YES', 'SIGNED', '', '', '', 'Proclaimers', '', '', '1',
      ],
    ];
    const wsBio = XLSX.utils.aoa_to_sheet(bioData);
    wsBio['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 28 }, { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 26 }, { wch: 26 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
      { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBio, 'Students');

    // ── 2. MEMBERSHIP (MEM-100) SHEET ────────────────────────────────────────
    // Header on Row 3; columns match ATS TEMPLATE.xlsx exactly
    const memData = [
      ['MEMBERSHIP — MEM-100 Class Records'],
      ['BATCH [CODE]. [MONTH, YEAR]'],
      [
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
      ],
      [
        '', 'SAMPLE STUDENT ONE', '', 'Trainer Name',
        20, 15, 15, 40, 10, 35, 95, 'YES', 'YES', 'ACTIVE', 'PASSED', 'SIGNED', 'NO', '', '', 'Excellent',
      ],
      [
        '', 'SAMPLE STUDENT TWO', '', 'Trainer Name',
        18, 12, 14, 38, 8, 30, 88, 'YES', 'NO', 'ACTIVE', 'PASSED', 'SIGNED', 'YES', '2026-01-15', '', '',
      ],
    ];
    const wsMem = XLSX.utils.aoa_to_sheet(memData);
    wsMem['!cols'] = [
      { wch: 24 }, { wch: 30 }, { wch: 10 }, { wch: 20 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMem, 'Membership (MEM-100)');

    // ── 3. MIT (MIT-200) SHEET ───────────────────────────────────────────────
    const mitData = [
      ['MIT — MIT-200 Class Records'],
      ['BATCH [CODE]. [MONTH, YEAR]'],
      [
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
      ],
      [
        '', 'SAMPLE STUDENT TWO', '', 'Trainer Name',
        20, 10, 10, 10, 10, 10, 10, 10, 10, 40, 90, 'PASSED', 'Ushering', 'YES', 'NO', '', 'Great dedication',
      ],
    ];
    const wsMit = XLSX.utils.aoa_to_sheet(mitData);
    wsMit['!cols'] = [
      { wch: 24 }, { wch: 30 }, { wch: 10 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 },
      { wch: 10 }, { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMit, 'MIT (MIT-200)');

    // ── 4. PROCLAIMERS (PRO-300) SHEET ───────────────────────────────────────
    const procData = [
      ['PROCLAIMERS — PRO-300 Class Records'],
      ['BATCH [CODE]. [MONTH, YEAR]'],
      [
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
      ],
      [
        '', 'SAMPLE STUDENT THREE', '', 'Trainer Name',
        'Media', 10, 15, 15, 10, 40, 10, 10, 95, 'RELEASED', 'NO', '', 'Completed project',
      ],
    ];
    const wsProc = XLSX.utils.aoa_to_sheet(procData);
    wsProc['!cols'] = [
      { wch: 24 }, { wch: 30 }, { wch: 10 }, { wch: 20 },
      { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
      { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsProc, 'Proclaimers (PRO-300)');

    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="ATS_Master_Migration_Template.xlsx"',
      },
    });
  } catch (err) {
    console.error('Template download error:', err);
    return NextResponse.json({ error: 'Failed to generate template.' }, { status: 500 });
  }
}
