import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import ExcelJS from 'exceljs';
import { requireAdmin } from '../../../../../lib/requireAdmin';

// ── 1. String Normalization & Similarity ─────────────────────────────────────

function normalizeHeader(str) {
  if (str == null) return '';
  return String(str)
    .trim()
    .toUpperCase()
    .replace(/[\s\t\n\r]+/g, ' ')
    .replace(/[^A-Z0-9\s/()\-.]/g, '');
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshtein(a, b) / maxLen;
}

// ── 2. Comprehensive Field Aliases Dictionary ────────────────────────────────

const FIELD_ALIASES = {
  CARD_NO: [
    'CHARTER MEMBERSHIP ID NO.', 'CHARTER MEMBERSHIP ID NO', 'CHARTER MEMBERSHIP ID CARD NO.',
    'CHARTER MEMBERSHIP ID CARD NO', 'CHARTER MEMBERSHIP ID CARD No:', 'CHARTER MEMBERSHIP  ID NO.',
    'CHARTER MEMBERSHIP ID', 'CHARTER ID', 'ID CARD NO', 'CARD NUMBER', 'CARD NO'
  ],
  NAME: [
    'NAMES', 'NAME', 'FULL NAME', 'FULL NAMES', 'FULLNAME', 'STUDENT NAME',
    'STUDENTS NAME', "STUDENT'S NAME", 'NAME OF STUDENT', 'NAMES OF STUDENTS', 'STUDENT', 'CANDIDATE'
  ],
  REG_NO: ['REG. NO.', 'REG. NO', 'REG NO', 'STUDENT ID', 'REGISTRATION NO', 'REGISTRATION NUMBER'],
  GENDER: ['GENDER', 'SEX'],
  DOB: ['DATE OF BIRTH', 'DOB', 'BIRTH DATE'],
  PHONE: ['PHONE NO.', 'PHONE NO', 'PHONE', 'MOBILE', 'TELEPHONE', 'MOBILE NO.'],
  EMAIL: ['EMAIL', 'EMAIL ADDRESS', 'E-MAIL'],
  ADDRESS: ['RESIDENTIAL ADDRESS', 'ADDRESS', 'HOME ADDRESS'],
  STATE_OF_ORIGIN: ['STATE OF ORIGIN', 'STATE ORIGIN'],
  LGA: ['HOME TOWN / LGA', 'HOME TOWN/LGA', 'LGA', 'LOCAL GOVERNMENT'],
  COUNTRY: ['COUNTRY OF RESIDENCE', 'COUNTRY'],
  NATIONALITY: ['NATIONALITY', 'CITIZENSHIP'],
  DEPARTMENT: ['DEPARTMENT, MINISTRY OR UNIT', 'DEPARTMENT/MINISTRY', 'DEPARTMENT / MINISTRY', 'DEPARTMENT', 'MINISTRY', 'UNIT'],
  NOK_NAME: ['NEXT OF KIN NAME', 'NEXT OF KIN'],
  NOK_PHONE: ['NEXT OF KIN PHONE NO.', 'NEXT OF KIN PHONE', 'NEXT OF KIN MOBILE'],
  NOK_REL: ['RELATIONSHIP WITH NEXT OF KIN', 'NEXT OF KIN RELATIONSHIP', 'RELATIONSHIP'],
  CLASS: ['CLASS', 'CLASS GROUP', 'GROUP'],
  TRAINER: ['TRAINERS', 'TRAINER', 'INSTRUCTOR', 'TEACHER'],
  ATTENDANCE: ['ATTENDANCE', 'ATTENDANCE SCORE', 'ATTEND'],
  TEST: ['TEST', 'TEST SCORE', 'MIDTERM TEST', 'MIDTERM'],
  ASSIGNMENT: ['ASSIGNMENT', 'ASSIGNMENT SCORE', 'TASKS'],
  ASSESSMENT: ['ASSESSMENT', 'ASSESSMENT SCORE', 'EVALUATION'],
  PRESENTATION: ['PRESENTATION', 'PRESENTATION SCORE', 'PRES'],
  EXAM: ['EXAM', 'FINAL EXAM', 'EXAM SCORE'],
  FINAL_GRADES: ['FINAL GRADES', 'FINAL GRADE', 'TOTAL', 'TOTAL GRADE', 'SCORE', 'OVERALL'],
  WATER_BAPTISM: ['BAPTISM (WATER)', 'WATER BAPTISM', 'BAPTISM WATER', 'WATER BAPTISM (YES/NO)'],
  HOLY_SPIRIT_BAPTISM: ['BAPTISM (HOLY SPIRIT)', 'HOLY SPIRIT BAPTISM', 'HOLY SPIRIT', 'BAPTISM HOLY SPIRIT'],
  PORTAL: ['PORTAL', 'PORTAL CREATED', 'PORTAL STATUS'],
  STATUS: ['STATUS', 'STATUS (RELEASED)', '(RELEASED)', 'REMARKS', 'GRADE STATUS'],
  COVENANT_DEED: ['COVENANT DEED', 'COVENANT DEED SIGNED', 'DEED'],
  ID_CARD_COLLECTED_DATE: ['ID CARD COLLECTED/DATE', 'ID CARD COLLECTED DATE', 'CARD COLLECTED DATE', 'ID CARD DATE'],
  COMMENTS: ['COMMENTS', 'COMMENTS ', 'COMMENT', 'REMARKS', 'NOTE', 'NOTES'],
  MIDTERM_TEST: ['MIDTERM TEST', 'MIDTERM', 'MID TERM TEST', 'MID-TERM TEST'],
  INTERACTIONS: ['INTERACTIONS', 'INTERACTION', 'CLASS INTERACTIONS'],
  BIBLE_STUDY: ['BIBLE STUDY', 'BIBLE STUDY ATTENDANCE'],
  CTH: ['CITH', 'CTH', 'CIH', 'C.I.H', 'C.T.H'],
  COMMUNITY_SERVICE: ['COMMUNITY SERVICE', 'SERVICE', 'COMMUNITY SERVICE SCORE'],
  EVANGELISM: ['EVANGELISM', 'EVANGELISM SCORE', 'OUTREACH'],
  DEPT_CONFIRMATION: ['DEPT. CONFIRMATION', 'DEPARTMENT CONFIRMATION', 'CONFIRMATION'],
  FIRST_TIMER: ['FIRST TIMER (YES/NO)', 'FIRST TIMER', 'FIRST TIMER?', 'IS FIRST TIMER'],
  DATE_JOINED: ['DATE JOINED', 'DATE  JOINED', 'DATE OF JOINING', 'JOIN DATE'],
  PROJECT: ['PROJECT', 'PROJECT SCORE', 'MINISTRY PROJECT'],
  MOUNTAIN_OF_INFLUENCE: ['MOUNTAIN OF INFLUENCE', 'MT. OF INFLUENCE', 'MT.OF INFLUENCE', 'INFLUENCE', 'MOUNTAIN INFLUENCE'],
  SEMINAR_ATTENDANCE: ['SEMINAR ATTENDANCE', 'SEMINAR', 'SEMINAR SCORE']
};

function resolveFieldValue(headerMap, fieldKey, rowValues, warnings = []) {
  const aliases = FIELD_ALIASES[fieldKey] || [];
  
  // 1. Direct normalized match
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    if (normAlias in headerMap) {
      return rowValues[headerMap[normAlias]];
    }
  }

  // 2. Substring match
  for (const [normHeader, colIdx] of Object.entries(headerMap)) {
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      if (normHeader.includes(normAlias) || normAlias.includes(normHeader)) {
        return rowValues[colIdx];
      }
    }
  }

  // 3. Fuzzy similarity match (threshold >= 0.75)
  let bestColIdx = -1;
  let maxSim = 0;
  let matchedHeader = '';

  for (const [normHeader, colIdx] of Object.entries(headerMap)) {
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      const sim = similarity(normHeader, normAlias);
      if (sim > maxSim && sim >= 0.75) {
        maxSim = sim;
        bestColIdx = colIdx;
        matchedHeader = normHeader;
      }
    }
  }

  if (bestColIdx !== -1) {
    warnings.push(`Fuzzy match used for '${fieldKey}': matched '${matchedHeader}' (sim: ${maxSim.toFixed(2)})`);
    return rowValues[bestColIdx];
  }

  return null;
}

// ── 3. Value Extraction Helpers ──────────────────────────────────────────────

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return str || null;
}

function normalizeGender(val) {
  if (!val) return 'Male';
  const s = String(val).trim().toLowerCase();
  if (s.startsWith('f')) return 'Female';
  return 'Male';
}

function parseFullName(fullNameStr) {
  if (!fullNameStr) return { first_name: 'STUDENT', surname: 'RECORD', middle_name: null };
  const parts = String(fullNameStr).trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], surname: parts[0], middle_name: null };
  if (parts.length === 2) return { first_name: parts[0], surname: parts[1], middle_name: null };
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    surname: parts[parts.length - 1],
  };
}

function extractCellValue(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined && v.result !== null) return v.result;
    if ('value' in v && v.value !== undefined && v.value !== null) return v.value;
    if ('text' in v && v.text !== undefined && v.text !== null) return v.text;
    return null;
  }
  return v;
}

function toNum(v) {
  const extracted = extractCellValue(v);
  if (extracted == null || extracted === '') return null;
  const n = Number(String(extracted).trim());
  return !isNaN(n) ? Math.round(n) : null;
}

function toStr(v) {
  const extracted = extractCellValue(v);
  if (extracted == null || extracted === '') return null;
  const str = String(extracted).trim();
  return str || null;
}

function generateUniqueEmail(firstName, surname) {
  const cleanFirst = String(firstName || 'student').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSurname = String(surname || 'record').toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomStr = Math.random().toString(36).substring(2, 7);
  return `${cleanFirst}.${cleanSurname}.${randomStr}@placeholder.com`;
}

function detectHeaderRow(rows, maxRowsToScan = 15) {
  let bestRowIdx = -1;
  let maxTextCount = 0;

  for (let r = 0; r < Math.min(rows.length, maxRowsToScan); r++) {
    const row = rows[r] || [];
    let textCellCount = 0;

    for (const cell of row) {
      const val = toStr(cell);
      if (val && typeof val === 'string' && val.length >= 2 && isNaN(Number(val))) {
        textCellCount++;
      }
    }

    if (textCellCount > maxTextCount && textCellCount >= 3) {
      maxTextCount = textCellCount;
      bestRowIdx = r;
    }
  }

  return bestRowIdx;
}

function deduplicateByStudentOrReg(payloads) {
  const map = new Map();
  for (const p of payloads) {
    const key = p.registration_id || p.student_id;
    if (key) {
      map.set(key, p);
    }
  }
  return Array.from(map.values());
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { id: batchId } = resolvedParams;

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, programme_type')
    .eq('id', batchId)
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let studentsProcessed = 0;
  let retakesProcessed = 0;
  let gradesUpdated = 0;
  const errors = [];
  const warnings = [];
  const retakingStudents = [];
  const sheetSummary = {};
  const dataEntryGaps = [];

  // 1. FAST PRE-FETCH FOR CACHING
  const [studentsRes, regsRes] = await Promise.all([
    supabaseAdmin.from('students').select('id, student_unique_id, card_number, email, surname, first_name, middle_name, batch_id, phone, home_address, local_government, country_of_residence, next_of_kin, next_of_kin_phone, next_of_kin_relationship'),
    supabaseAdmin.from('registrations').select('id, student_id, batch_id, stage, department').eq('batch_id', batchId),
  ]);

  const studentCache = new Map();
  const regMap = new Map();

  (studentsRes.data || []).forEach((s) => {
    if (s.student_unique_id) studentCache.set(s.student_unique_id.toUpperCase(), s);
    if (s.card_number) studentCache.set(s.card_number.toUpperCase(), s);
    if (s.email && !s.email.includes('placeholder.com')) studentCache.set(s.email.toLowerCase(), s);

    const fn1 = `${s.surname || ''} ${s.first_name || ''}`.trim().toUpperCase();
    const fn2 = `${s.first_name || ''} ${s.surname || ''}`.trim().toUpperCase();
    const fn3 = `${s.surname || ''} ${s.first_name || ''} ${s.middle_name || ''}`.trim().toUpperCase();

    if (fn1) studentCache.set(fn1, s);
    if (fn2) studentCache.set(fn2, s);
    if (fn3) studentCache.set(fn3, s);
  });

  (regsRes.data || []).forEach((r) => {
    regMap.set(`${r.student_id}_${r.stage}`, r.id);
  });

  let nextSeq = 1;
  const numMatch = (batch.batch_code || '').match(/\d+/);
  const batchTag = numMatch ? numMatch[0] : (batch.batch_code || 'ATS').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();

  (studentsRes.data || []).forEach((s) => {
    if (s.student_unique_id) {
      const parts = s.student_unique_id.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num >= nextSeq) nextSeq = num + 1;
    }
  });

  async function safeInsertStudent(studentPayload) {
    let payload = { ...studentPayload };
    let { data, error } = await supabaseAdmin.from('students').insert(payload).select('id, student_unique_id, surname, first_name, middle_name, email, card_number, batch_id').single();

    while (error && error.message) {
      const match = error.message.match(/Could not find the '([^']+)' column of 'students'/i);
      if (match && match[1]) {
        const badCol = match[1];
        delete payload[badCol];
        const retryRes = await supabaseAdmin.from('students').insert(payload).select('id, student_unique_id, surname, first_name, middle_name, email, card_number, batch_id').single();
        data = retryRes.data;
        error = retryRes.error;
      } else {
        break;
      }
    }
    return { data, error };
  }

  async function safeUpdateStudent(studentId, updatePayload) {
    if (!updatePayload || Object.keys(updatePayload).length === 0) return;
    let payload = { ...updatePayload };
    let { error } = await supabaseAdmin.from('students').update(payload).eq('id', studentId);

    while (error && error.message) {
      const match = error.message.match(/Could not find the '([^']+)' column of 'students'/i);
      if (match && match[1]) {
        const badCol = match[1];
        delete payload[badCol];
        if (Object.keys(payload).length === 0) break;
        const retryRes = await supabaseAdmin.from('students').update(payload).eq('id', studentId);
        error = retryRes.error;
      } else {
        break;
      }
    }
  }

  async function resolveOrCreateStudentFast(headerMap, rowValues) {
    const cardNo = toStr(resolveFieldValue(headerMap, 'CARD_NO', rowValues, warnings));
    const fullName = toStr(resolveFieldValue(headerMap, 'NAME', rowValues, warnings));

    if (!fullName && !cardNo) return null;

    const email = toStr(resolveFieldValue(headerMap, 'EMAIL', rowValues, warnings));
    const { first_name, middle_name, surname } = parseFullName(fullName);

    // JOIN KEY: Match Charter Membership ID Number first, then Full Name, then Email
    let s = null;
    if (cardNo) s = studentCache.get(cardNo.toUpperCase());
    if (!s && fullName) s = studentCache.get(fullName.toUpperCase());
    if (!s && email && !email.includes('placeholder.com')) s = studentCache.get(email.toLowerCase());

    if (!s && fullName) {
      const fn1 = `${surname} ${first_name}`.toUpperCase();
      const fn2 = `${first_name} ${surname}`.toUpperCase();
      s = studentCache.get(fn1) || studentCache.get(fn2);
    }

    if (s) {
      const updateData = {};
      if (cardNo && !s.card_number) updateData.card_number = cardNo;
      const phone = toStr(resolveFieldValue(headerMap, 'PHONE', rowValues, warnings));
      if (phone && phone !== '00000000000' && (!s.phone || s.phone === '00000000000')) updateData.phone = phone;
      const address = toStr(resolveFieldValue(headerMap, 'ADDRESS', rowValues, warnings));
      if (address && !s.home_address) updateData.home_address = address;
      const lga = toStr(resolveFieldValue(headerMap, 'LGA', rowValues, warnings));
      if (lga && !s.local_government) updateData.local_government = lga;
      const country = toStr(resolveFieldValue(headerMap, 'COUNTRY', rowValues, warnings));
      if (country && !s.country_of_residence) updateData.country_of_residence = country;
      const nokName = toStr(resolveFieldValue(headerMap, 'NOK_NAME', rowValues, warnings));
      if (nokName && !s.next_of_kin) updateData.next_of_kin = nokName;
      const nokPhone = toStr(resolveFieldValue(headerMap, 'NOK_PHONE', rowValues, warnings));
      if (nokPhone && !s.next_of_kin_phone) updateData.next_of_kin_phone = nokPhone;
      const nokRel = toStr(resolveFieldValue(headerMap, 'NOK_REL', rowValues, warnings));
      if (nokRel && !s.next_of_kin_relationship) updateData.next_of_kin_relationship = nokRel;

      if (Object.keys(updateData).length > 0) {
        await safeUpdateStudent(s.id, updateData);
      }
      studentsProcessed++;
      return s.id;
    }

    // Create new student
    const regNo = toStr(resolveFieldValue(headerMap, 'REG_NO', rowValues, warnings));
    let studentUniqueId = (regNo && regNo.toUpperCase().startsWith('ATS')) ? regNo : `ATS-${batchTag}-${String(nextSeq++).padStart(4, '0')}`;
    const studentEmail = email || generateUniqueEmail(first_name, surname);

    const { data: created, error: createErr } = await safeInsertStudent({
      batch_id: batchId,
      student_unique_id: studentUniqueId,
      first_name,
      middle_name,
      surname,
      email: studentEmail,
      phone: toStr(resolveFieldValue(headerMap, 'PHONE', rowValues, warnings)) || '00000000000',
      gender: normalizeGender(resolveFieldValue(headerMap, 'GENDER', rowValues, warnings)),
      card_number: cardNo,
      date_of_birth: parseExcelDate(resolveFieldValue(headerMap, 'DOB', rowValues, warnings)),
      home_address: toStr(resolveFieldValue(headerMap, 'ADDRESS', rowValues, warnings)),
      state_of_origin: toStr(resolveFieldValue(headerMap, 'STATE_OF_ORIGIN', rowValues, warnings)),
      nationality: toStr(resolveFieldValue(headerMap, 'NATIONALITY', rowValues, warnings)),
      local_government: toStr(resolveFieldValue(headerMap, 'LGA', rowValues, warnings)),
      country_of_residence: toStr(resolveFieldValue(headerMap, 'COUNTRY', rowValues, warnings)),
      church_join_date: parseExcelDate(resolveFieldValue(headerMap, 'DATE_JOINED', rowValues, warnings)),
      next_of_kin: toStr(resolveFieldValue(headerMap, 'NOK_NAME', rowValues, warnings)),
      next_of_kin_phone: toStr(resolveFieldValue(headerMap, 'NOK_PHONE', rowValues, warnings)),
      next_of_kin_relationship: toStr(resolveFieldValue(headerMap, 'NOK_REL', rowValues, warnings)),
    });

    if (created) {
      studentsProcessed++;
      if (fullName) studentCache.set(fullName.toUpperCase(), created);
      if (cardNo) studentCache.set(cardNo.toUpperCase(), created);
      if (studentEmail) studentCache.set(studentEmail.toLowerCase(), created);
      return created.id;
    } else if (createErr) {
      errors.push(`Student Creation Error (${fullName || cardNo}): ${createErr.message}`);
    }

    return null;
  }

  async function ensureRegistrationFast(studentId, stage, department = null) {
    const key = `${studentId}_${stage}`;
    if (regMap.has(key)) {
      const regId = regMap.get(key);
      if (department) {
        await supabaseAdmin.from('registrations').update({ department }).eq('id', regId);
      }
      return regId;
    }

    const { data: newReg } = await supabaseAdmin
      .from('registrations')
      .insert({ student_id: studentId, batch_id: batchId, stage, department: department || null })
      .select('id')
      .single();

    if (newReg) {
      regMap.set(key, newReg.id);
      return newReg.id;
    }

    const { data: existingReg } = await supabaseAdmin
      .from('registrations')
      .select('id')
      .eq('student_id', studentId)
      .eq('batch_id', batchId)
      .eq('stage', stage)
      .maybeSingle();

    if (existingReg) {
      regMap.set(key, existingReg.id);
      if (department) {
        await supabaseAdmin.from('registrations').update({ department }).eq('id', existingReg.id);
      }
      return existingReg.id;
    }

    return null;
  }

  const memGradePayloads = [];
  const mitGradePayloads = [];
  const procGradePayloads = [];

  for (const ws of workbook.worksheets) {
    try {
      const rawRows = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        rawRows.push(row.values.slice(1));
      });
      if (rawRows.length === 0) continue;

      const headerIdx = detectHeaderRow(rawRows);
      if (headerIdx === -1) {
        sheetSummary[ws.name] = { status: 'NO_HEADER_ROW_FOUND' };
        continue;
      }

      const headerRow = rawRows[headerIdx];
      const headerMap = {};
      headerRow.forEach((cellVal, colIdx) => {
        const norm = normalizeHeader(toStr(cellVal));
        if (norm) headerMap[norm] = colIdx;
      });

      const dataRows = rawRows.slice(headerIdx + 1);
      const nameUpper = (ws.name || '').toUpperCase();

      let isBioSheet = /BIO|STUDENT|MASTER/i.test(nameUpper);
      let isMemSheet = /MEMBERSHIP|MEM-100/i.test(nameUpper);
      let isMitSheet = /MIT|MIT-200/i.test(nameUpper);
      let isProcSheet = /PROCLAIM|PRO-300|PROCLAIMER/i.test(nameUpper);

      if (!isBioSheet && !isMemSheet && !isMitSheet && !isProcSheet) {
        if ('RESIDENTIAL ADDRESS' in headerMap || 'NATIONALITY' in headerMap) isBioSheet = true;
        else if ('WATER BAPTISM' in headerMap || 'COVENANT DEED' in headerMap) isMemSheet = true;
        else if ('MIDTERM TEST' in headerMap || 'BIBLE STUDY' in headerMap) isMitSheet = true;
        else if ('MOUNTAIN OF INFLUENCE' in headerMap || 'PROJECT' in headerMap || 'SEMINAR ATTENDANCE' in headerMap) isProcSheet = true;
      }

      // 1. Master Biodata Sheet
      if (isBioSheet) {
        let bioCount = 0;
        for (let i = 0; i < dataRows.length; i++) {
          try {
            const rowValues = dataRows[i];
            const studentId = await resolveOrCreateStudentFast(headerMap, rowValues);
            if (studentId) {
              bioCount++;
              const dept = toStr(resolveFieldValue(headerMap, 'DEPARTMENT', rowValues, warnings));
              await ensureRegistrationFast(studentId, 'membership', dept);

              const nokName = toStr(resolveFieldValue(headerMap, 'NOK_NAME', rowValues, warnings));
              const nokPhone = toStr(resolveFieldValue(headerMap, 'NOK_PHONE', rowValues, warnings));
              const nokRel = toStr(resolveFieldValue(headerMap, 'NOK_REL', rowValues, warnings));
              const firstTimerVal = toStr(resolveFieldValue(headerMap, 'FIRST_TIMER', rowValues, warnings));

              const bioUpdate = {};
              if (nokName) bioUpdate.next_of_kin = nokName;
              if (nokPhone) bioUpdate.next_of_kin_phone = nokPhone;
              if (nokRel) bioUpdate.next_of_kin_relationship = nokRel;
              if (firstTimerVal) bioUpdate.is_first_timer = firstTimerVal;

              if (Object.keys(bioUpdate).length > 0) {
                await safeUpdateStudent(studentId, bioUpdate);
              }
            }
          } catch (rowErr) {
            warnings.push(`Bio Sheet Row ${i + 1} Error: ${rowErr.message}`);
          }
        }
        sheetSummary[ws.name] = { headerRowIndex: headerIdx + 1, dataRowsRead: dataRows.length, studentsProcessed: bioCount };
      }

      // 2. Membership Grades Sheet
      if (isMemSheet) {
        let memCount = 0;
        for (let i = 0; i < dataRows.length; i++) {
          try {
            const rowValues = dataRows[i];
            const targetStudentId = await resolveOrCreateStudentFast(headerMap, rowValues);

            if (targetStudentId) {
              const regId = await ensureRegistrationFast(targetStudentId, 'membership');
              memCount++;
              memGradePayloads.push({
                student_id: targetStudentId,
                registration_id: regId,
                class: toStr(resolveFieldValue(headerMap, 'CLASS', rowValues, warnings)),
                trainer: toStr(resolveFieldValue(headerMap, 'TRAINER', rowValues, warnings)),
                attendance: toNum(resolveFieldValue(headerMap, 'ATTENDANCE', rowValues, warnings)),
                test: toNum(resolveFieldValue(headerMap, 'TEST', rowValues, warnings)),
                assignment: toNum(resolveFieldValue(headerMap, 'ASSIGNMENT', rowValues, warnings)),
                assessment: toNum(resolveFieldValue(headerMap, 'ASSESSMENT', rowValues, warnings)),
                presentation: toNum(resolveFieldValue(headerMap, 'PRESENTATION', rowValues, warnings)),
                exam: toNum(resolveFieldValue(headerMap, 'EXAM', rowValues, warnings)),
                final_grades: toNum(resolveFieldValue(headerMap, 'FINAL_GRADES', rowValues, warnings)),
                water_baptism: toStr(resolveFieldValue(headerMap, 'WATER_BAPTISM', rowValues, warnings)),
                holy_spirit_baptism: toStr(resolveFieldValue(headerMap, 'HOLY_SPIRIT_BAPTISM', rowValues, warnings)),
                portal: toStr(resolveFieldValue(headerMap, 'PORTAL', rowValues, warnings)),
                status: toStr(resolveFieldValue(headerMap, 'STATUS', rowValues, warnings)),
                comments: toStr(resolveFieldValue(headerMap, 'COMMENTS', rowValues, warnings)),
                covenant_deed: toStr(resolveFieldValue(headerMap, 'COVENANT_DEED', rowValues, warnings)),
                id_card_collected_date: parseExcelDate(resolveFieldValue(headerMap, 'ID_CARD_COLLECTED_DATE', rowValues, warnings)),
                updated_at: new Date().toISOString(),
              });
            }
          } catch (rowErr) {
            warnings.push(`MEM Sheet Row ${i + 1} Error: ${rowErr.message}`);
          }
        }
        sheetSummary[ws.name] = { headerRowIndex: headerIdx + 1, dataRowsRead: dataRows.length, gradesParsed: memCount, hasScoreData: true };
      }

      // 3. MIT Grades Sheet
      if (isMitSheet) {
        let mitCount = 0;
        let scoreCellsFound = false;

        for (let i = 0; i < dataRows.length; i++) {
          try {
            const rowValues = dataRows[i];
            const targetStudentId = await resolveOrCreateStudentFast(headerMap, rowValues);

            if (targetStudentId) {
              const department = toStr(resolveFieldValue(headerMap, 'DEPARTMENT', rowValues, warnings));
              const regId = await ensureRegistrationFast(targetStudentId, 'mit', department || 'General');

              mitCount++;
              const finalExamScore = toNum(resolveFieldValue(headerMap, 'EXAM', rowValues, warnings));
              const midtermScore = toNum(resolveFieldValue(headerMap, 'MIDTERM_TEST', rowValues, warnings));
              if (finalExamScore != null || midtermScore != null) scoreCellsFound = true;

              mitGradePayloads.push({
                student_id: targetStudentId,
                registration_id: regId,
                class: toStr(resolveFieldValue(headerMap, 'CLASS', rowValues, warnings)),
                trainer: toStr(resolveFieldValue(headerMap, 'TRAINER', rowValues, warnings)),
                midterm_test: midtermScore,
                interactions: toNum(resolveFieldValue(headerMap, 'INTERACTIONS', rowValues, warnings)),
                bible_study: toNum(resolveFieldValue(headerMap, 'BIBLE_STUDY', rowValues, warnings)),
                assignment: toNum(resolveFieldValue(headerMap, 'ASSIGNMENT', rowValues, warnings)),
                attendance: toNum(resolveFieldValue(headerMap, 'ATTENDANCE', rowValues, warnings)),
                cth: toNum(resolveFieldValue(headerMap, 'CTH', rowValues, warnings)),
                community_service: toNum(resolveFieldValue(headerMap, 'COMMUNITY_SERVICE', rowValues, warnings)),
                evangelism: toNum(resolveFieldValue(headerMap, 'EVANGELISM', rowValues, warnings)),
                presentation: toNum(resolveFieldValue(headerMap, 'PRESENTATION', rowValues, warnings)),
                final_exam: finalExamScore,
                exam: finalExamScore,
                final_grades: toNum(resolveFieldValue(headerMap, 'FINAL_GRADES', rowValues, warnings)),
                status: toStr(resolveFieldValue(headerMap, 'STATUS', rowValues, warnings)),
                comments: toStr(resolveFieldValue(headerMap, 'COMMENTS', rowValues, warnings)),
                department: department || toStr(resolveFieldValue(headerMap, 'DEPARTMENT', rowValues, warnings)),
                department_confirmation: toStr(resolveFieldValue(headerMap, 'DEPT_CONFIRMATION', rowValues, warnings)),
                first_timer: toStr(resolveFieldValue(headerMap, 'FIRST_TIMER', rowValues, warnings)),
                first_timer_date: parseExcelDate(resolveFieldValue(headerMap, 'DATE_JOINED', rowValues, warnings)),
                updated_at: new Date().toISOString(),
              });
            }
          } catch (rowErr) {
            warnings.push(`MIT Sheet Row ${i + 1} Error: ${rowErr.message}`);
          }
        }

        if (!scoreCellsFound) {
          dataEntryGaps.push(`MIT - 200: ${dataRows.length} student rows found, but score cells (Midterm, Final Exam) are blank in source Excel file.`);
        }
        sheetSummary[ws.name] = { headerRowIndex: headerIdx + 1, dataRowsRead: dataRows.length, registrationsImported: mitCount, hasScoreData: scoreCellsFound };
      }

      // 4. Proclaimers Grades Sheet
      if (isProcSheet) {
        let procCount = 0;
        let scoreCellsFound = false;

        for (let i = 0; i < dataRows.length; i++) {
          try {
            const rowValues = dataRows[i];
            const targetStudentId = await resolveOrCreateStudentFast(headerMap, rowValues);

            if (targetStudentId) {
              const department = toStr(resolveFieldValue(headerMap, 'DEPARTMENT', rowValues, warnings));
              const regId = await ensureRegistrationFast(targetStudentId, 'proclaimers', department || 'General');

              procCount++;
              const influenceScore = toStr(resolveFieldValue(headerMap, 'MOUNTAIN_OF_INFLUENCE', rowValues, warnings));
              const projectScore = toNum(resolveFieldValue(headerMap, 'PROJECT', rowValues, warnings));
              if (influenceScore != null || projectScore != null) scoreCellsFound = true;

              procGradePayloads.push({
                student_id: targetStudentId,
                registration_id: regId,
                class: toStr(resolveFieldValue(headerMap, 'CLASS', rowValues, warnings)),
                trainer: toStr(resolveFieldValue(headerMap, 'TRAINER', rowValues, warnings)),
                cih: toNum(resolveFieldValue(headerMap, 'CTH', rowValues, warnings)),
                attendance: toNum(resolveFieldValue(headerMap, 'ATTENDANCE', rowValues, warnings)),
                assessment: toNum(resolveFieldValue(headerMap, 'ASSESSMENT', rowValues, warnings)),
                presentation: toNum(resolveFieldValue(headerMap, 'PRESENTATION', rowValues, warnings)),
                project: projectScore,
                seminar_attendance: toNum(resolveFieldValue(headerMap, 'SEMINAR_ATTENDANCE', rowValues, warnings)),
                final_grades: toNum(resolveFieldValue(headerMap, 'FINAL_GRADES', rowValues, warnings)),
                mountain_of_influence: influenceScore,
                influence: influenceScore,
                first_timer: toStr(resolveFieldValue(headerMap, 'FIRST_TIMER', rowValues, warnings)),
                first_timer_date: parseExcelDate(resolveFieldValue(headerMap, 'DATE_JOINED', rowValues, warnings)),
                status: toStr(resolveFieldValue(headerMap, 'STATUS', rowValues, warnings)),
                comments: toStr(resolveFieldValue(headerMap, 'COMMENTS', rowValues, warnings)),
                department: department || toStr(resolveFieldValue(headerMap, 'DEPARTMENT', rowValues, warnings)),
                updated_at: new Date().toISOString(),
              });
            }
          } catch (rowErr) {
            warnings.push(`PRO Sheet Row ${i + 1} Error: ${rowErr.message}`);
          }
        }

        if (!scoreCellsFound) {
          dataEntryGaps.push(`PRO - 300: ${dataRows.length} student rows found, but score cells (Project, Influence) are blank in source Excel file.`);
        }
        sheetSummary[ws.name] = { headerRowIndex: headerIdx + 1, dataRowsRead: dataRows.length, registrationsImported: procCount, hasScoreData: scoreCellsFound };
      }

    } catch (sheetErr) {
      errors.push(`Worksheet '${ws.name}' Error: ${sheetErr.message}`);
    }
  }

  // De-duplicate payloads by registration_id or student_id
  const uniqueMemGrades = deduplicateByStudentOrReg(memGradePayloads);
  const uniqueMitGrades = deduplicateByStudentOrReg(mitGradePayloads);
  const uniqueProcGrades = deduplicateByStudentOrReg(procGradePayloads);

  // Helper for resilient upserting
  async function safeUpsert(tableName, payloads) {
    if (!payloads || payloads.length === 0) return 0;

    let currentPayloads = payloads.map(p => ({ ...p }));
    
    // Primary conflict attempt 1: student_id
    let { error: firstErr } = await supabaseAdmin.from(tableName).upsert(currentPayloads, { onConflict: 'student_id' });
    if (!firstErr) return currentPayloads.length;

    // Primary conflict attempt 2: registration_id
    let { error: secondErr } = await supabaseAdmin.from(tableName).upsert(currentPayloads, { onConflict: 'registration_id' });
    if (!secondErr) return currentPayloads.length;

    let lastError = firstErr || secondErr;
    while (lastError && lastError.message) {
      const match = lastError.message.match(/Could not find the '([^']+)' column of/i);
      if (match && match[1]) {
        const badCol = match[1];
        currentPayloads.forEach(p => delete p[badCol]);
        const { error: retryErr } = await supabaseAdmin.from(tableName).upsert(currentPayloads, { onConflict: 'student_id' });
        if (!retryErr) return currentPayloads.length;
        
        const { error: retryErr2 } = await supabaseAdmin.from(tableName).upsert(currentPayloads, { onConflict: 'registration_id' });
        if (!retryErr2) return currentPayloads.length;

        lastError = retryErr2;
      } else {
        break;
      }
    }

    errors.push(`${tableName} Upsert Error: ${lastError.message}`);
    return 0;
  }

  // Bulk upsert clean payloads
  if (uniqueMemGrades.length > 0) {
    gradesUpdated += await safeUpsert('membership_grades', uniqueMemGrades);
  }

  if (uniqueMitGrades.length > 0) {
    gradesUpdated += await safeUpsert('mit_grades', uniqueMitGrades);
  }

  if (uniqueProcGrades.length > 0) {
    gradesUpdated += await safeUpsert('proclaimers_grades', uniqueProcGrades);
  }

  return NextResponse.json({
    success: true,
    studentsProcessed,
    retakesProcessed,
    gradesUpdated,
    sheetSummary,
    dataEntryGaps,
    warnings: Array.from(new Set(warnings)),
    errors,
    retakingStudents,
  });
}
