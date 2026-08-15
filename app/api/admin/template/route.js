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

    // ── 1. GUIDELINES & INSTRUCTIONS SHEET ────────────────────────────
    const instructionsData = [
      ['ATS MASTER MIGRATION & DATA IMPORT INSTRUCTIONS'],
      [''],
      ['IMPORTANT PORTAL FORMATTING RULES:'],
      ['1. STUDENT NAMES (SURNAME, FIRST NAME, MIDDLE NAME):'],
      ['   -> All student names will automatically be formatted and listed in BLOCK LETTERS (UPPERCASE) on the portal.'],
      [''],
      ['2. REGISTRATION NUMBER & ID CARD NUMBER:'],
      ['   -> Registration Numbers (e.g. ATS-056-0001) and Card Numbers (e.g. CARD-001) will automatically be centered and formatted on the portal.'],
      [''],
      ['3. EXCEL SHEETS INCLUDED IN THIS TEMPLATE:'],
      ['   - Sheet 1: GUIDELINES & INSTRUCTIONS (This page)'],
      ['   - Sheet 2: STUDENTS MASTER BIO (Personal biodata, contact info, state, LGA, ID card no)'],
      ['   - Sheet 3: MEMBERSHIP GRADES (Class group, trainer, attendance, test, exam scores, status)'],
      ['   - Sheet 4: MIT GRADES (Midterm test, interactions, bible study, final exam, status)'],
      ['   - Sheet 5: PROCLAIMERS GRADES (CIH, project, seminar, status)'],
      [''],
      ['4. DATA IMPORT HINT:'],
      ['   -> You can upload student bio data and grades together or separately. The system automatically links students across sheets by Email, ID Card No, or Name.'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'GUIDELINES & INSTRUCTIONS');

    // ── 2. STUDENTS MASTER BIO SHEET ────────────────────────────────
    const bioData = [
      [
        'FULL NAME', 'GENDER', 'DATE OF BIRTH', 'EMAIL', 'PHONE NO',
        'RESIDENTIAL ADDRESS', 'STATE OF ORIGIN', 'NATIONALITY', 'ID CARD NO'
      ],
      [
        'ADEBAYO OLUWASEUN DANIEL', 'Male', '1998-05-14', 'seun.adebayo@example.com', '08012345678',
        '12 Allen Avenue, Ikeja, Lagos', 'Lagos', 'Nigerian', 'CARD-001'
      ],
      [
        'OKONKWO CHINWE MARY', 'Female', '2001-09-22', 'chinwe.mary@example.com', '08098765432',
        '45 Victoria Island, Lagos', 'Anambra', 'Nigerian', 'CARD-002'
      ],
    ];
    const wsBio = XLSX.utils.aoa_to_sheet(bioData);
    wsBio['!cols'] = [
      { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 28 }, { wch: 16 },
      { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsBio, 'STUDENTS MASTER BIO');

    // ── 3. MEMBERSHIP GRADES SHEET ──────────────────────────────────
    const memData = [
      [
        'FULL NAME', 'ID CARD NO', 'CLASS GROUP', 'TRAINERS',
        'ATTENDANCE', 'TEST', 'ASSIGNMENT', 'ASSESSMENT', 'PRESENTATION',
        'EXAM', 'FINAL GRADES', 'BAPTISM (WATER)', 'BAPTISM (HOLY SPIRIT)',
        'PORTAL', 'STATUS', 'COMMENTS', 'COVENANT DEED', 'ID CARD COLLECTED DATE'
      ],
      [
        'ADEBAYO OLUWASEUN DANIEL', 'CARD-001', 'Group A', 'Pastor John',
        10, 15, 15, 10, 10, 35, 95, 'YES', 'YES', 'ACTIVE', 'PASSED', 'Excellent performance', 'SIGNED', '2026-08-01'
      ]
    ];
    const wsMem = XLSX.utils.aoa_to_sheet(memData);
    wsMem['!cols'] = [
      { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMem, 'MEMBERSHIP GRADES');

    // ── 4. MIT GRADES SHEET ─────────────────────────────────────────
    const mitData = [
      [
        'FULL NAME', 'ID CARD NO', 'CLASS GROUP', 'TRAINERS',
        'MIDTERM TEST', 'INTERACTIONS', 'BIBLE STUDY', 'ASSIGNMENT', 'ATTENDANCE',
        'CTH', 'COMMUNITY SERVICE', 'EVANGELISM', 'PRESENTATION', 'FINAL EXAM',
        'FINAL GRADES', 'STATUS', 'COMMENTS', 'DEPARTMENT'
      ],
      [
        'ADEBAYO OLUWASEUN DANIEL', 'CARD-001', 'MIT Alpha', 'Evang. Paul',
        20, 10, 10, 10, 10, 10, 10, 10, 10, 40, 90, 'PASSED', 'Great dedication', 'Ushering'
      ]
    ];
    const wsMit = XLSX.utils.aoa_to_sheet(mitData);
    wsMit['!cols'] = [
      { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 },
      { wch: 10 }, { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMit, 'MIT GRADES');

    // ── 5. PROCLAIMERS GRADES SHEET ────────────────────────────────
    const procData = [
      [
        'FULL NAME', 'STUDENT ID', 'CLASS', 'TRAINER',
        'CIH', 'ATTENDANCE', 'ASSESSMENT', 'PRESENTATION', 'PROJECT',
        'INFLUENCE', 'ATTENDANCE', 'FINAL GRADES', '(RELEASED)', 'COMMENTS', 'DEPARTMENT'
      ],
      [
        'ADEBAYO OLUWASEUN DANIEL', 'ATS-056-0001', 'Proc 1', 'Pastor Grace',
        10, 15, 15, 10, 40, 10, 10, 95, 'PASSED', 'Completed seminar project', 'Media'
      ]
    ];
    const wsProc = XLSX.utils.aoa_to_sheet(procData);
    wsProc['!cols'] = [
      { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 20 },
      { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
      { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsProc, 'PROCLAIMERS GRADES');

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
