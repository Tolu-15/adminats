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

// Convert Excel dates (serial numbers or string formats) to YYYY-MM-DD
function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const y = dateObj.y;
      const m = String(dateObj.m).padStart(2, '0');
      const d = String(dateObj.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str || null;
}

// Normalize gender string to match PostgreSQL check constraint ('Male', 'Female')
function normalizeGender(val) {
  if (!val) return 'Male';
  const s = String(val).trim().toLowerCase();
  if (s.startsWith('f')) return 'Female';
  return 'Male';
}

// Split full name into first_name, middle_name, surname
function parseFullName(fullNameStr) {
  if (!fullNameStr) return { first_name: 'Student', surname: 'Record', middle_name: null };
  const parts = String(fullNameStr).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { first_name: parts[0], surname: parts[0], middle_name: null };
  }
  if (parts.length === 2) {
    return { first_name: parts[0], surname: parts[1], middle_name: null };
  }
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    surname: parts[parts.length - 1],
  };
}

const toNum = (v) => (v !== '' && v != null && !isNaN(Number(v)) ? Number(v) : null);
const toStr = (v) => (v !== '' && v != null ? String(v).trim() : null);

export async function POST(request, { params }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: batchId } = params;

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
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  let studentsProcessed = 0;
  let gradesUpdated = 0;
  const errors = [];

  // Helper map to cache student_unique_id / name -> student.id
  const studentCache = new Map();

  // Helper function to resolve header row index (scanning first 10 rows)
  function findHeaderRow(rows, keywords) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rowStr = JSON.stringify(rows[r] || []).toUpperCase();
      if (keywords.some((kw) => rowStr.includes(kw.toUpperCase()))) {
        return r;
      }
    }
    return -1;
  }

  // Helper to construct key-value map for a row using headers
  function mapRow(headers, row) {
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) {
        const cleanKey = String(h).trim().toUpperCase();
        obj[cleanKey] = row[idx];
      }
    });
    return obj;
  }

  // ────────────────────────────────────────────────────────────
  // 1. PROCESS MASTER BIO DATA SHEET (if present, e.g. "Students")
  // ────────────────────────────────────────────────────────────
  const studentSheetName = wb.SheetNames.find((name) =>
    /STUDENT/i.test(name) || /BIO/i.test(name) || /MASTER/i.test(name)
  );

  if (studentSheetName) {
    const ws = wb.Sheets[studentSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['FULL NAME', 'NAME', 'ID CARD NO', 'EMAIL', 'GENDER']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = toStr(r['FULL NAME'] || r['NAME'] || r['STUDENT NAME']);
        if (!fullName) continue;

        const { first_name, middle_name, surname } = parseFullName(fullName);
        const cardNo = toStr(r['ID CARD NO'] || r['CARD NUMBER'] || r['CARD NO']);
        const email = toStr(r['EMAIL']);
        const phone = toStr(r['PHONE NO'] || r['PHONE'] || r['MOBILE']);
        const gender = toStr(r['GENDER']);
        const dob = parseExcelDate(r['DATE OF BIRTH'] || r['DOB']);
        const address = toStr(r['RESIDENTIAL ADDRESS'] || r['ADDRESS']);
        const stateOfOrigin = toStr(r['STATE OF ORIGIN']);
        const nationality = toStr(r['NATIONALITY']);

        // Check if student exists in this batch by unique ID, email, or full name
        let { data: existing } = await supabaseAdmin
          .from('students')
          .select('id, student_unique_id')
          .eq('batch_id', batchId)
          .or(`email.eq.${email || '___'},surname.ilike.${surname}`)
          .maybeSingle();

        let studentId = existing?.id;

        if (!studentId) {
          // Generate student_unique_id
          let customUniqueId = toStr(r['ID CARD NO']);
          if (!customUniqueId || customUniqueId.length < 3) {
            const { data: generatedId } = await supabaseAdmin.rpc('generate_student_id', {
              p_batch_code: batch.batch_code,
            });
            customUniqueId = generatedId || `ATS-${batch.batch_code}-${Date.now().toString().slice(-4)}`;
          }

          const newRecord = {
            batch_id: batchId,
            student_unique_id: customUniqueId,
            first_name,
            middle_name,
            surname,
            email: email || `${first_name.toLowerCase()}.${surname.toLowerCase()}.${Date.now().toString().slice(-4)}@placeholder.com`,
            phone: phone || '00000000000',
            gender: normalizeGender(gender),
            date_of_birth: dob,
            home_address: address,
            state_of_origin: stateOfOrigin,
            nationality: nationality,
            card_number: cardNo,
          };

          const { data: created, error: createErr } = await supabaseAdmin
            .from('students')
            .insert(newRecord)
            .select('id, student_unique_id')
            .single();

          if (createErr) {
            errors.push(`Students Sheet Row ${i + headerIdx + 2}: ${createErr.message}`);
          } else {
            studentId = created.id;
            studentsProcessed++;
          }
        }

        if (studentId) {
          studentCache.set(fullName.toUpperCase(), studentId);
          if (cardNo) studentCache.set(cardNo.toUpperCase(), studentId);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 2. PROCESS MEMBERSHIP GRADES SHEET ("Membership (MEM-100)" or single sheet)
  // ────────────────────────────────────────────────────────────
  const memSheetName = wb.SheetNames.find((name) =>
    /MEMBERSHIP/i.test(name) || /MEM-100/i.test(name)
  ) || (batch.programme_type === 'MEMBERSHIP' ? wb.SheetNames[0] : null);

  if (memSheetName) {
    const ws = wb.Sheets[memSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['FULL NAME', 'ATTENDANCE', 'EXAM', 'FINAL GRADES', 'STATUS']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = toStr(r['FULL NAME'] || r['NAME'] || r['STUDENT NAME']);
        if (!fullName) continue;

        // Resolve student ID
        let targetStudentId = studentCache.get(fullName.toUpperCase());
        if (!targetStudentId) {
          const { first_name, surname } = parseFullName(fullName);
          const { data: found } = await supabaseAdmin
            .from('students')
            .select('id')
            .eq('batch_id', batchId)
            .ilike('surname', surname)
            .ilike('first_name', first_name)
            .maybeSingle();

          if (found) {
            targetStudentId = found.id;
          } else {
            // Auto-create student record if not found from master bio sheet
            const { data: generatedId } = await supabaseAdmin.rpc('generate_student_id', {
              p_batch_code: batch.batch_code,
            });
            const { data: created } = await supabaseAdmin
              .from('students')
              .insert({
                batch_id: batchId,
                student_unique_id: generatedId || `ATS-${batch.batch_code}-${Date.now().toString().slice(-4)}`,
                first_name,
                surname,
                email: `${first_name.toLowerCase()}.${surname.toLowerCase()}.${Date.now().toString().slice(-4)}@placeholder.com`,
                phone: '00000000000',
                gender: 'Male',
              })
              .select('id')
              .single();
            if (created) {
              targetStudentId = created.id;
              studentsProcessed++;
            }
          }
        }

        if (targetStudentId) {
          const gradePayload = {
            student_id: targetStudentId,
            class: toStr(r['CLASS GROUP'] || r['CLASS']),
            trainer: toStr(r['TRAINERS'] || r['TRAINER']),
            attendance: toNum(r['ATTENDANCE']),
            test: toNum(r['TEST']),
            assignment: toNum(r['ASSIGNMENT']),
            assessment: toNum(r['ASSESSMENT']),
            presentation: toNum(r['PRESENTATION']),
            exam: toNum(r['EXAM']),
            final_grades: toNum(r['FINAL GRADES'] || r['FINAL GRADE']),
            water_baptism: toStr(r['BAPTISM (WATER)']),
            holy_spirit_baptism: toStr(r['BAPTISM (HOLY SPIRIT)']),
            portal: toStr(r['PORTAL']),
            status: toStr(r['STATUS']),
            comments: toStr(r['COMMENTS']),
            covenant_deed: toStr(r['COVENANT DEED']),
            updated_at: new Date().toISOString(),
          };

          const { error: gradeErr } = await supabaseAdmin
            .from('student_grades')
            .upsert(gradePayload, { onConflict: 'student_id' });

          if (gradeErr) {
            errors.push(`Membership Sheet Row ${i + headerIdx + 2}: ${gradeErr.message}`);
          } else {
            gradesUpdated++;
          }
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 3. PROCESS MIT GRADES SHEET ("MIT (MIT-200)" or MIT batch sheet)
  // ────────────────────────────────────────────────────────────
  const mitSheetName = wb.SheetNames.find((name) =>
    /MIT/i.test(name) || /MIT-200/i.test(name)
  ) || (batch.programme_type === 'MIT' ? wb.SheetNames[0] : null);

  if (mitSheetName && batch.programme_type === 'MIT') {
    const ws = wb.Sheets[mitSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['FULL NAME', 'MIDTERM TEST', 'FINAL EXAM', 'FINAL GRADES', 'DEPARTMENT']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = toStr(r['FULL NAME'] || r['NAME'] || r['STUDENT NAME']);
        if (!fullName) continue;

        const { first_name, surname } = parseFullName(fullName);
        const department = toStr(r['DEPARTMENT']);

        // Check if student exists in database
        let { data: student } = await supabaseAdmin
          .from('students')
          .select('id')
          .ilike('surname', surname)
          .ilike('first_name', first_name)
          .maybeSingle();

        if (!student) {
          const { data: created } = await supabaseAdmin
            .from('students')
            .insert({
              batch_id: batchId,
              student_unique_id: `ATS-MIT-${batch.batch_code}-${Date.now().toString().slice(-4)}`,
              first_name,
              surname,
              email: `${first_name.toLowerCase()}.${surname.toLowerCase()}.${Date.now().toString().slice(-4)}@placeholder.com`,
              phone: '00000000000',
              gender: 'Male',
            })
            .select('id')
            .single();
          student = created;
          if (student) studentsProcessed++;
        }

        if (student) {
          // Ensure mit_registrations record exists
          let { data: reg } = await supabaseAdmin
            .from('mit_registrations')
            .select('id')
            .eq('batch_id', batchId)
            .eq('membership_student_id', student.id)
            .maybeSingle();

          if (!reg) {
            const { data: createdReg } = await supabaseAdmin
              .from('mit_registrations')
              .insert({
                batch_id: batchId,
                membership_student_id: student.id,
                department: department,
              })
              .select('id')
              .single();
            reg = createdReg;
          }

          if (reg) {
            const mitGradePayload = {
              mit_registration_id: reg.id,
              class: toStr(r['CLASS GROUP'] || r['CLASS']),
              trainer: toStr(r['TRAINERS'] || r['TRAINER']),
              midterm_test: toNum(r['MIDTERM TEST']),
              interactions: toNum(r['INTERACTIONS']),
              bible_study: toNum(r['BIBLE STUDY']),
              assignment: toNum(r['ASSIGNMENT']),
              attendance: toNum(r['ATTENDANCE']),
              cth: toNum(r['CITH'] || r['CTH']),
              community_service: toNum(r['SERVICE'] || r['COMMUNITY SERVICE']),
              evangelism: toNum(r['EVANGELISM']),
              presentation: toNum(r['PRESENTATION']),
              final_exam: toNum(r['FINAL EXAM']),
              final_grades: toNum(r['FINAL GRADES']),
              status: toStr(r['STATUS']),
              comments: toStr(r['COMMENTS']),
              department: department,
              updated_at: new Date().toISOString(),
            };

            const { error: mitGradeErr } = await supabaseAdmin
              .from('mit_grades')
              .upsert(mitGradePayload, { onConflict: 'mit_registration_id' });

            if (mitGradeErr) {
              errors.push(`MIT Sheet Row ${i + headerIdx + 2}: ${mitGradeErr.message}`);
            } else {
              gradesUpdated++;
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    studentsProcessed,
    gradesUpdated,
    errors,
    message: `Migration complete: ${studentsProcessed} new student(s) imported, ${gradesUpdated} grade record(s) processed.`,
  });
}
