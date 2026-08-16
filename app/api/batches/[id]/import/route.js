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

function normalizeGender(val) {
  if (!val) return 'Male';
  const s = String(val).trim().toLowerCase();
  if (s.startsWith('f')) return 'Female';
  return 'Male';
}

function parseFullName(fullNameStr) {
  if (!fullNameStr) return { first_name: 'STUDENT', surname: 'RECORD', middle_name: null };
  const parts = String(fullNameStr).trim().toUpperCase().split(/\s+/).filter(Boolean);
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

function generateUniqueEmail(firstName, surname) {
  const cleanFirst = String(firstName || 'student').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSurname = String(surname || 'record').toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomStr = Math.random().toString(36).substring(2, 7);
  return `${cleanFirst}.${cleanSurname}.${randomStr}@placeholder.com`;
}

async function generateUniqueStudentId(batchId, batchCode, preferredId = null) {
  if (preferredId) {
    const clean = String(preferredId).trim();
    if (clean.length >= 3) {
      const { data } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('student_unique_id', clean)
        .limit(1);
      if (!data || data.length === 0) {
        return clean;
      }
    }
  }

  const { data: existingStudents } = await supabaseAdmin
    .from('students')
    .select('student_unique_id')
    .eq('batch_id', batchId);

  let maxSeq = 0;
  if (existingStudents && existingStudents.length > 0) {
    for (const s of existingStudents) {
      if (s.student_unique_id) {
        const parts = s.student_unique_id.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxSeq) {
          maxSeq = lastNum;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(4, '0');
  const numMatch = (batchCode || '').match(/\d+/);
  const batchTag = numMatch ? numMatch[0] : (batchCode || 'ATS').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `ATS-${batchTag}-${seqStr}`;
}

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
  let retakesProcessed = 0;
  let gradesUpdated = 0;
  const errors = [];
  const retakingStudents = [];

  const studentCache = new Map();

  // Search first 10 rows for a header row matching any keyword
  function findHeaderRow(rows, keywords) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rowStr = JSON.stringify(rows[r] || []).toUpperCase();
      if (keywords.some((kw) => rowStr.includes(kw.toUpperCase()))) {
        return r;
      }
    }
    return -1;
  }

  // Map a data row to an object keyed by trimmed uppercase header names
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

  // Helper: resolve a student ID from the grade sheet card-no column or name cache
  function resolveCardNo(r) {
    return toStr(
      r['CHARTER MEMBERSHIP ID NO.'] ||
      r['CHARTER MEMBERSHIP  ID NO.'] ||
      r['ID CARD NO'] ||
      r['CARD NUMBER'] ||
      r['CARD NO']
    );
  }

  function resolveFullName(r) {
    return toStr(r['NAMES'] || r[' NAMES'] || r['FULL NAME'] || r['NAME'] || r['STUDENT NAME']);
  }

  // ── 1. STUDENTS MASTER BIO SHEET ──────────────────────────────────────────
  const studentSheetName = wb.SheetNames.find((name) =>
    /STUDENT/i.test(name) || /BIO/i.test(name) || /MASTER/i.test(name)
  );

  if (studentSheetName) {
    const ws = wb.Sheets[studentSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['NAMES', 'CHARTER MEMBERSHIP', 'EMAIL', 'GENDER', 'PHONE']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);

        // Primary name field is now "NAMES"; fall back to older variants
        const fullName = resolveFullName(r);
        if (!fullName) continue;

        const { first_name, middle_name, surname } = parseFullName(fullName);

        // Card number — now "CHARTER MEMBERSHIP ID NO." in new template
        const cardNo = resolveCardNo(r);

        const email    = toStr(r['EMAIL']);
        const phone    = toStr(r['PHONE NO.'] || r['PHONE NO'] || r['PHONE'] || r['MOBILE']);
        const gender   = toStr(r['GENDER']);
        const dob      = parseExcelDate(r['DATE OF BIRTH'] || r['DOB']);
        const address  = toStr(r['RESIDENTIAL ADDRESS'] || r['ADDRESS']);
        const stateOfOrigin = toStr(r['STATE OF ORIGIN']);
        const nationality   = toStr(r['NATIONALITY']);

        // New fields added to updated template
        const localGovt             = toStr(r['HOME TOWN / LGA'] || r['LGA']);
        const nextOfKin             = toStr(r['NEXT OF KIN NAME'] || r['NEXT OF KIN']);
        const nextOfKinPhone        = toStr(r['NEXT OF KIN PHONE NO.'] || r['NEXT OF KIN PHONE']);
        const nextOfKinRelationship = toStr(r['RELATIONSHIP WITH NEXT OF KIN'] || r['NEXT OF KIN RELATIONSHIP']);

        let studentId = null;
        let existingStudent = null;

        // Global lookup by email
        if (email) {
          const { data } = await supabaseAdmin
            .from('students')
            .select('id, student_unique_id, batch_id, surname, first_name')
            .eq('email', email)
            .limit(1);
          if (data && data.length > 0) existingStudent = data[0];
        }

        // Global lookup by card number / student_unique_id
        if (!existingStudent && cardNo) {
          const { data } = await supabaseAdmin
            .from('students')
            .select('id, student_unique_id, batch_id, surname, first_name')
            .or(`card_number.eq.${cardNo},student_unique_id.eq.${cardNo}`)
            .limit(1);
          if (data && data.length > 0) existingStudent = data[0];
        }

        // Global lookup by name
        if (!existingStudent) {
          const { data } = await supabaseAdmin
            .from('students')
            .select('id, student_unique_id, batch_id, surname, first_name')
            .ilike('surname', surname)
            .ilike('first_name', first_name)
            .limit(1);
          if (data && data.length > 0) existingStudent = data[0];
        }

        if (existingStudent) {
          studentId = existingStudent.id;

          // If from a previous batch → Retake
          if (existingStudent.batch_id !== batchId) {
            await supabaseAdmin
              .from('students')
              .update({
                batch_id: batchId,
                ...(cardNo ? { card_number: cardNo } : {}),
                ...(phone && phone !== '00000000000' ? { phone } : {}),
                ...(localGovt ? { local_government: localGovt } : {}),
                ...(nextOfKin ? { next_of_kin: nextOfKin } : {}),
                ...(nextOfKinPhone ? { next_of_kin_phone: nextOfKinPhone } : {}),
                ...(nextOfKinRelationship ? { next_of_kin_relationship: nextOfKinRelationship } : {}),
              })
              .eq('id', studentId);

            retakesProcessed++;
            if (!retakingStudents.some((s) => s.id === studentId)) {
              retakingStudents.push({
                id: studentId,
                name: `${existingStudent.surname} ${existingStudent.first_name}`,
                student_unique_id: existingStudent.student_unique_id,
              });
            }

            // Reset grade with retake comment
            const { data: existingGrade } = await supabaseAdmin
              .from('student_grades')
              .select('id, status')
              .eq('student_id', studentId)
              .maybeSingle();

            const prevStatus = (existingGrade?.status || '').toUpperCase();
            const retakeComment = `RETAKE — Re-enrolled into ${batch.batch_name} (#${batch.batch_code}). Prior status: ${prevStatus || 'NOT GRADED'}`;

            if (existingGrade) {
              await supabaseAdmin
                .from('student_grades')
                .update({
                  comments: retakeComment,
                  status: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingGrade.id);
            }
          }
        } else {
          // New student — create with collision fallback
          let insertSuccess = false;
          let attempts = 0;
          let preferredId = cardNo;

          while (!insertSuccess && attempts < 5) {
            attempts++;
            const studentUniqueId = await generateUniqueStudentId(batchId, batch.batch_code, preferredId);
            const studentEmail = email || generateUniqueEmail(first_name, surname);

            const newRecord = {
              batch_id: batchId,
              student_unique_id: studentUniqueId,
              first_name,
              middle_name,
              surname,
              email: studentEmail,
              phone: phone || '00000000000',
              gender: normalizeGender(gender),
              date_of_birth: dob,
              home_address: address,
              state_of_origin: stateOfOrigin,
              nationality: nationality,
              card_number: cardNo,
              ...(localGovt ? { local_government: localGovt } : {}),
              ...(nextOfKin ? { next_of_kin: nextOfKin } : {}),
              ...(nextOfKinPhone ? { next_of_kin_phone: nextOfKinPhone } : {}),
              ...(nextOfKinRelationship ? { next_of_kin_relationship: nextOfKinRelationship } : {}),
            };

            const { data: created, error: createErr } = await supabaseAdmin
              .from('students')
              .insert(newRecord)
              .select('id, student_unique_id')
              .single();

            if (createErr) {
              if (
                createErr.message?.includes('students_student_unique_id_key') ||
                createErr.message?.includes('duplicate key')
              ) {
                preferredId = null;
                continue;
              } else {
                errors.push(`Students Sheet Row ${i + headerIdx + 2}: ${createErr.message}`);
                break;
              }
            } else {
              studentId = created.id;
              studentsProcessed++;
              insertSuccess = true;
            }
          }
        }

        if (studentId) {
          studentCache.set(fullName.toUpperCase(), studentId);
          if (cardNo) studentCache.set(cardNo.toUpperCase(), studentId);
        }
      }
    }
  }

  // ── 2. MEMBERSHIP GRADES SHEET ─────────────────────────────────────────────
  const memSheetName = wb.SheetNames.find((name) =>
    /MEMBERSHIP/i.test(name) || /MEM-100/i.test(name)
  ) || (batch.programme_type === 'MEMBERSHIP' ? wb.SheetNames[0] : null);

  if (memSheetName) {
    const ws = wb.Sheets[memSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['NAMES', 'ATTENDANCE', 'FINAL GRADES', 'STATUS', 'BAPTISM']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = resolveFullName(r);
        if (!fullName) continue;

        let targetStudentId = studentCache.get(fullName.toUpperCase());

        // Also try lookup by card number from this sheet
        if (!targetStudentId) {
          const sheetCardNo = resolveCardNo(r);
          if (sheetCardNo) targetStudentId = studentCache.get(sheetCardNo.toUpperCase());
        }

        if (!targetStudentId) {
          const { first_name, surname } = parseFullName(fullName);
          const { data: foundList } = await supabaseAdmin
            .from('students')
            .select('id, batch_id, student_unique_id')
            .ilike('surname', surname)
            .ilike('first_name', first_name)
            .limit(1);

          if (foundList && foundList.length > 0) {
            const found = foundList[0];
            targetStudentId = found.id;
            if (found.batch_id !== batchId) {
              await supabaseAdmin.from('students').update({ batch_id: batchId }).eq('id', found.id);
              retakesProcessed++;
              if (!retakingStudents.some((s) => s.id === found.id)) {
                retakingStudents.push({
                  id: found.id,
                  name: `${surname} ${first_name}`,
                  student_unique_id: found.student_unique_id,
                });
              }
            }
          } else {
            // Auto-create minimal student record
            let insertSuccess = false;
            let attempts = 0;
            while (!insertSuccess && attempts < 5) {
              attempts++;
              const studentUniqueId = await generateUniqueStudentId(batchId, batch.batch_code);
              const { data: created, error: createErr } = await supabaseAdmin
                .from('students')
                .insert({
                  batch_id: batchId,
                  student_unique_id: studentUniqueId,
                  first_name,
                  surname,
                  email: generateUniqueEmail(first_name, surname),
                  phone: '00000000000',
                  gender: 'Male',
                })
                .select('id')
                .single();

              if (createErr) {
                if (
                  createErr.message?.includes('students_student_unique_id_key') ||
                  createErr.message?.includes('duplicate key')
                ) {
                  continue;
                }
                break;
              } else if (created) {
                targetStudentId = created.id;
                studentsProcessed++;
                insertSuccess = true;
              }
            }
          }
        }

        if (targetStudentId) {
          // Update card number if supplied in this sheet
          const importedCardNo = resolveCardNo(r);
          if (importedCardNo) {
            await supabaseAdmin
              .from('students')
              .update({ card_number: importedCardNo })
              .eq('id', targetStudentId);
          }

          // Update student-level fields: first timer & date joined
          const firstTimer  = toStr(r['FIRST TIMER (YES/NO)']);
          const dateJoined  = parseExcelDate(r['DATE  JOINED'] || r['DATE JOINED'] || r['DATE OF JOINING']);
          if (firstTimer || dateJoined) {
            const studentPatch = {};
            if (firstTimer) studentPatch.is_first_timer = firstTimer;
            if (dateJoined) studentPatch.church_join_date = dateJoined;
            await supabaseAdmin.from('students').update(studentPatch).eq('id', targetStudentId);
          }

          const gradePayload = {
            student_id: targetStudentId,
            class: toStr(r['CLASS'] || r['CLASS GROUP']),
            trainer: toStr(r['TRAINERS'] || r['TRAINER']),
            attendance: toNum(r['ATTENDANCE']),
            test: toNum(r['TEST']),
            assignment: toNum(r['ASSIGNMENT']),
            assessment: toNum(r['ASSESSMENT']),
            presentation: toNum(r['PRESENTATION']),
            exam: toNum(r['EXAM']),
            final_grades: toNum(r['FINAL GRADES'] || r['FINAL GRADE']),
            water_baptism: toStr(r['BAPTISM (WATER)'] || r['WATER BAPTISM']),
            holy_spirit_baptism: toStr(r['BAPTISM (HOLY SPIRIT)'] || r['HOLY SPIRIT BAPTISM']),
            portal: toStr(r['PORTAL']),
            status: toStr(r['STATUS']),
            comments: toStr(r['COMMENTS']),
            covenant_deed: toStr(r['COVENANT DEED']),
            // Updated column name: "ID CARD COLLECTED/DATE" (slash, not space)
            id_card_collected_date: parseExcelDate(
              r['ID CARD COLLECTED/DATE'] || r['ID CARD COLLECTED DATE']
            ),
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

  // ── 3. MIT GRADES SHEET ────────────────────────────────────────────────────
  const mitSheetName = wb.SheetNames.find((name) =>
    /MIT/i.test(name) || /MIT-200/i.test(name)
  ) || (batch.programme_type === 'MIT' ? wb.SheetNames[0] : null);

  if (mitSheetName && (batch.programme_type === 'MIT' || /MIT/i.test(mitSheetName))) {
    const ws = wb.Sheets[mitSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['NAMES', 'MIDTERM TEST', 'FINAL EXAM', 'FINAL GRADES', 'CITH']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = resolveFullName(r);
        if (!fullName) continue;

        const { first_name, surname } = parseFullName(fullName);
        // Department column in MIT sheet
        const department = toStr(r['DEPARTMENT'] || r['DEPARTMENT/MINISTRY']);

        let targetStudent = null;

        // Try cache first (by name or card)
        let cachedId = studentCache.get(fullName.toUpperCase());
        if (!cachedId) {
          const sheetCardNo = resolveCardNo(r);
          if (sheetCardNo) cachedId = studentCache.get(sheetCardNo.toUpperCase());
        }

        if (cachedId) {
          targetStudent = { id: cachedId };
        } else {
          const { data: foundList } = await supabaseAdmin
            .from('students')
            .select('id, batch_id, student_unique_id')
            .ilike('surname', surname)
            .ilike('first_name', first_name)
            .limit(1);

          if (foundList && foundList.length > 0) {
            targetStudent = foundList[0];
          } else {
            let insertSuccess = false;
            let attempts = 0;
            while (!insertSuccess && attempts < 5) {
              attempts++;
              const studentUniqueId = await generateUniqueStudentId(batchId, batch.batch_code);
              const { data: created, error: createErr } = await supabaseAdmin
                .from('students')
                .insert({
                  batch_id: batchId,
                  student_unique_id: studentUniqueId,
                  first_name,
                  surname,
                  email: generateUniqueEmail(first_name, surname),
                  phone: '00000000000',
                  gender: 'Male',
                })
                .select('id')
                .single();

              if (createErr) {
                if (
                  createErr.message?.includes('students_student_unique_id_key') ||
                  createErr.message?.includes('duplicate key')
                ) {
                  continue;
                }
                break;
              } else if (created) {
                targetStudent = created;
                studentsProcessed++;
                insertSuccess = true;
              }
            }
          }
        }

        if (targetStudent) {
          let { data: reg } = await supabaseAdmin
            .from('mit_registrations')
            .select('id')
            .eq('batch_id', batchId)
            .eq('membership_student_id', targetStudent.id)
            .maybeSingle();

          if (!reg) {
            const { data: priorMit } = await supabaseAdmin
              .from('mit_registrations')
              .select('id')
              .eq('membership_student_id', targetStudent.id);

            if (priorMit && priorMit.length > 0) {
              retakesProcessed++;
              if (!retakingStudents.some((s) => s.id === targetStudent.id)) {
                retakingStudents.push({
                  id: targetStudent.id,
                  name: `${surname} ${first_name}`,
                  student_unique_id: targetStudent.student_unique_id,
                });
              }
            }

            const { data: createdReg } = await supabaseAdmin
              .from('mit_registrations')
              .insert({
                batch_id: batchId,
                membership_student_id: targetStudent.id,
                department: department || 'General',
              })
              .select('id')
              .single();
            reg = createdReg;
          }

          if (reg) {
            const mitGradePayload = {
              mit_registration_id: reg.id,
              class: toStr(r['CLASS'] || r['CLASS GROUP']),
              trainer: toStr(r['TRAINERS'] || r['TRAINER']),
              midterm_test: toNum(r['MIDTERM TEST']),
              interactions: toNum(r['INTERACTIONS']),
              bible_study: toNum(r['BIBLE STUDY']),
              assignment: toNum(r['ASSIGNMENT']),
              attendance: toNum(r['ATTENDANCE']),
              cth: toNum(r['CITH'] || r['CTH']),
              // New template uses "COMMUNITY SERVICE" (older used "SERVICE")
              community_service: toNum(r['COMMUNITY SERVICE'] || r['SERVICE']),
              evangelism: toNum(r['EVANGELISM']),
              presentation: toNum(r['PRESENTATION']),
              final_exam: toNum(r['FINAL EXAM']),
              final_grades: toNum(r['FINAL GRADES']),
              status: toStr(r['STATUS']),
              comments: toStr(r['COMMENTS']),
              department: department,
              // Updated column name: "DEPT. CONFIRMATION" (was "CONFIRMATION")
              department_confirmation: toStr(r['DEPT. CONFIRMATION'] || r['CONFIRMATION']),
              first_timer: toStr(r['FIRST TIMER (YES/NO)']),
              first_timer_date: parseExcelDate(r['DATE  JOINED'] || r['DATE JOINED'] || r['DATE OF JOINING']),
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

  // ── 4. PROCLAIMERS GRADES SHEET ────────────────────────────────────────────
  const procSheetName = wb.SheetNames.find((name) =>
    /PROCLAIMERS/i.test(name) || /PROCLAIMER/i.test(name) || /PRO-300/i.test(name)
  ) || (batch.programme_type === 'PROCLAIMERS' ? wb.SheetNames[0] : null);

  if (procSheetName) {
    const ws = wb.Sheets[procSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['NAMES', 'CITH', 'PROJECT', 'FINAL GRADES', 'SEMINAR']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = resolveFullName(r);
        if (!fullName) continue;

        const { first_name, surname } = parseFullName(fullName);
        // Department — updated template uses "DEPARTMENT/MINISTRY" combined column
        const department = toStr(
          r['DEPARTMENT/MINISTRY'] ||
          r['DEPARTMENT / MINISTRY'] ||
          r['MINISTRY'] ||
          r['DEPARTMENT']
        );

        let targetStudent = null;

        let cachedId = studentCache.get(fullName.toUpperCase());
        if (!cachedId) {
          const sheetCardNo = resolveCardNo(r);
          if (sheetCardNo) cachedId = studentCache.get(sheetCardNo.toUpperCase());
        }

        if (cachedId) {
          targetStudent = { id: cachedId };
        } else {
          const { data: foundList } = await supabaseAdmin
            .from('students')
            .select('id, batch_id, student_unique_id')
            .ilike('surname', surname)
            .ilike('first_name', first_name)
            .limit(1);

          if (foundList && foundList.length > 0) {
            targetStudent = foundList[0];
          } else {
            let insertSuccess = false;
            let attempts = 0;
            while (!insertSuccess && attempts < 5) {
              attempts++;
              const studentUniqueId = await generateUniqueStudentId(batchId, batch.batch_code);
              const { data: created, error: createErr } = await supabaseAdmin
                .from('students')
                .insert({
                  batch_id: batchId,
                  student_unique_id: studentUniqueId,
                  first_name,
                  surname,
                  email: generateUniqueEmail(first_name, surname),
                  phone: '00000000000',
                  gender: 'Male',
                })
                .select('id')
                .single();

              if (createErr) {
                if (
                  createErr.message?.includes('students_student_unique_id_key') ||
                  createErr.message?.includes('duplicate key')
                ) {
                  continue;
                }
                break;
              } else if (created) {
                targetStudent = created;
                studentsProcessed++;
                insertSuccess = true;
              }
            }
          }
        }

        if (targetStudent) {
          let { data: reg } = await supabaseAdmin
            .from('proclaimers_registrations')
            .select('id')
            .eq('batch_id', batchId)
            .eq('membership_student_id', targetStudent.id)
            .maybeSingle();

          if (!reg) {
            const { data: priorProc } = await supabaseAdmin
              .from('proclaimers_registrations')
              .select('id')
              .eq('membership_student_id', targetStudent.id);

            if (priorProc && priorProc.length > 0) {
              retakesProcessed++;
              if (!retakingStudents.some((s) => s.id === targetStudent.id)) {
                retakingStudents.push({
                  id: targetStudent.id,
                  name: `${surname} ${first_name}`,
                  student_unique_id: targetStudent.student_unique_id,
                });
              }
            }

            const { data: createdReg } = await supabaseAdmin
              .from('proclaimers_registrations')
              .insert({
                batch_id: batchId,
                membership_student_id: targetStudent.id,
                department: department || 'General',
              })
              .select('id')
              .single();
            reg = createdReg;
          }

          if (reg) {
            const procGradePayload = {
              proclaimers_registration_id: reg.id,
              class: toStr(r['CLASS'] || r['CLASS GROUP']),
              trainer: toStr(r['TRAINERS'] || r['TRAINER']),
              // CITH maps to assignment field in proclaimers_grades
              assignment: toNum(r['CITH'] || r['CIH'] || r['ASSIGNMENT']),
              attendance: toNum(r['ATTENDANCE']),
              assessment: toNum(r['ASSESSMENT']),
              presentation: toNum(r['PRESENTATION']),
              exam: toNum(r['PROJECT'] || r['EXAM']),
              final_grades: toNum(r['FINAL GRADES']),
              // Updated: "STATUS (RELEASED)" is the exact column name in new template
              status: toStr(r['STATUS (RELEASED)'] || r['STATUS']),
              comments: toStr(r['COMMENTS']),
              department: department,
              // New fields — require schema migration
              influence: toNum(r['MT.OF INFLUENCE'] || r['MT. OF INFLUENCE'] || r['INFLUENCE']),
              seminar_attendance: toNum(r['SEMINAR ATTENDANCE']),
              first_timer: toStr(r['FIRST TIMER (YES/NO)']),
              first_timer_date: parseExcelDate(r['DATE JOINED'] || r['DATE  JOINED'] || r['DATE OF JOINING']),
              updated_at: new Date().toISOString(),
            };

            const { error: procGradeErr } = await supabaseAdmin
              .from('proclaimers_grades')
              .upsert(procGradePayload, { onConflict: 'proclaimers_registration_id' });

            if (procGradeErr) {
              errors.push(`Proclaimers Sheet Row ${i + headerIdx + 2}: ${procGradeErr.message}`);
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
    retakesProcessed,
    retakingStudents,
    gradesUpdated,
    errors,
    message: retakesProcessed > 0
      ? `Migration complete: ${studentsProcessed} new student(s) imported, ${retakesProcessed} retake student(s) re-enrolled into this batch, ${gradesUpdated} grade record(s) processed.`
      : `Migration complete: ${studentsProcessed} new student(s) imported, ${gradesUpdated} grade record(s) processed.`,
  });
}
