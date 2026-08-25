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
  const safeCode = (batch.batch_name || 'Batch').replace(/\s+/g, '_');

  // ── 1. MEMBERSHIP STUDENTS SHEET ────────────────────────────
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('batch_id', id)
    .order('created_at', { ascending: true });

  if (students && students.length > 0) {
    const memGradesList = await Promise.all(
      students.map(async (s) => {
        const { data: g } = await supabaseAdmin
          .from('student_grades')
          .select('*')
          .eq('student_id', s.id)
          .maybeSingle();
        return { student: s, grade: g || {} };
      })
    );

    const ws_data = [
      ['MEMBERSHIP GRADES', '', '', '', '', '', '', '', '', '', `${(batch.batch_name || '').toUpperCase()}`, '', '', '', '', '', '', '', ''],
      [
        'STUDENT NAME', 'STUDENT ID', 'CHARTER MEMBERSHIP ID CARD No.', 'CLASS', 'TRAINERS',
        'ATTENDANCE', 'TEST', 'ASSIGNMENT', 'ASSESSMENT', 'PRESENTATION',
        'EXAM', 'FINAL GRADES', 'WATER BAPTISM', 'HOLY SPIRIT BAPTISM',
        'PORTAL', 'STATUS', 'COMMENTS', 'COVENANT DEED', 'ID CARD COLLECTED DATE',
      ],
    ];

    for (const { student: s, grade: g } of memGradesList) {
      ws_data.push([
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

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [
      { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
      { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
      { wch: 24 }, { wch: 16 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Membership');
  }

  // ── 2. MIT STUDENTS SHEET ───────────────────────────────────
  const { data: mitRegs } = await supabaseAdmin
    .from('mit_registrations')
    .select(`
      id, department,
      membership_student:students(surname, first_name, middle_name, student_unique_id, card_number)
    `)
    .eq('batch_id', id)
    .order('created_at', { ascending: true });

  if (mitRegs && mitRegs.length > 0) {
    const mitGradesList = await Promise.all(
      mitRegs.map(async (reg) => {
        const { data: g } = await supabaseAdmin
          .from('mit_grades')
          .select('*')
          .eq('mit_registration_id', reg.id)
          .maybeSingle();
        return { reg, grade: g || {} };
      })
    );

    const ws_data = [
      ['MIT GRADES', '', '', '', '', '', '', '', '', '', '', `${(batch.batch_name || '').toUpperCase()}`, '', '', '', '', '', '', '', '', '', ''],
      [
        'STUDENT NAME', 'STUDENT ID', 'CHARTER MEMBERSHIP ID CARD No.', 'CLASS', 'TRAINERS',
        'MIDTERM TEST', 'INTERACTIONS', 'BIBLE STUDY', 'ASSIGNMENT', 'ATTENDANCE',
        'CTH', 'COMMUNITY SERVICE', 'EVANGELISM', 'PRESENTATION', 'FINAL EXAM',
        'FINAL GRADES', 'STATUS', 'COMMENTS', 'DEPARTMENT', 'DEPARTMENT CONFIRMATION',
        'FIRST TIMER (YES/NO)', 'FIRST TIMER DATE OF JOINING',
      ],
    ];

    for (const { reg, grade: g } of mitGradesList) {
      const s = reg.membership_student || {};
      ws_data.push([
        `${s.surname || ''} ${s.first_name || ''}${s.middle_name ? ' ' + s.middle_name : ''}`,
        s.student_unique_id || '',
        s.card_number ?? '',
        g.class ?? '', g.trainer ?? '',
        g.midterm_test ?? '', g.interactions ?? '', g.bible_study ?? '',
        g.assignment ?? '', g.attendance ?? '', g.cth ?? '',
        g.community_service ?? '', g.evangelism ?? '', g.presentation ?? '',
        g.final_exam ?? '', g.final_grades ?? '', g.status ?? '',
        g.comments ?? '', g.department ?? reg.department ?? '',
        g.department_confirmation ?? '', g.first_timer ?? '',
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
    XLSX.utils.book_append_sheet(wb, ws, 'MIT');
  }

  // ── 3. PROCLAIMERS STUDENTS SHEET ───────────────────────────
  const { data: procRegs } = await supabaseAdmin
    .from('proclaimers_registrations')
    .select(`
      id, department,
      membership_student:students(surname, first_name, middle_name, student_unique_id, card_number)
    `)
    .eq('batch_id', id)
    .order('created_at', { ascending: true });

  if (procRegs && procRegs.length > 0) {
    const procGradesList = await Promise.all(
      procRegs.map(async (reg) => {
        const { data: g } = await supabaseAdmin
          .from('proclaimers_grades')
          .select('*')
          .eq('proclaimers_registration_id', reg.id)
          .maybeSingle();
        return { reg, grade: g || {} };
      })
    );

    const ws_data = [
      // Top header row matching official Proclaimers format exactly
      ['PROCLAIMERS GRADES', '', '', '', '', '', 'CONTINUS', '', '', 'MOUNTAIN OF', 'SEMINAR', '', 'STATUS', '', `${(batch.batch_name || '').toUpperCase()}`],
      [
        'STUDENT NAME', 'STUDENT ID', 'CLASS', 'TRAINER',
        'CIH', 'ATTENDANCE', 'ASSESSMENT', 'PRESENTATION', 'PROJECT',
        'INFLUENCE', 'ATTENDANCE', 'FINAL GRADES', '(RELEASED)', 'COMMENTS', 'DEPARTMENT'
      ],
    ];

    for (const { reg, grade: g } of procGradesList) {
      const s = reg.membership_student || {};
      ws_data.push([
        `${s.surname || ''} ${s.first_name || ''}${s.middle_name ? ' ' + s.middle_name : ''}`,
        s.student_unique_id || '',
        g.class ?? '', g.trainer ?? '',
        g.cih ?? '',
        g.attendance ?? '',
        g.assessment ?? '',
        g.presentation ?? '',
        g.project ?? '',
        g.mountain_of_influence ?? '',
        g.seminar_attendance ?? '',
        g.final_grades ?? '',
        g.status ?? '',
        g.comments ?? '',
        g.department ?? reg.department ?? '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [
      { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 20 },
      { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
      { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Proclaimers');
  }

  // Fallback if batch has no students in any category
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No registrations found for this batch.']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  const fileName = `Batch_${safeCode}_Grades.xlsx`;
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
