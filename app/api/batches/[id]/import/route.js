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

function generateUniqueEmail(firstName, surname) {
  const cleanFirst = String(firstName || 'student').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSurname = String(surname || 'record').toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomStr = Math.random().toString(36).substring(2, 7);
  return `${cleanFirst}.${cleanSurname}.${randomStr}@placeholder.com`;
}

async function generateUniqueStudentId(batchCode, preferredId = null) {
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

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: generatedId } = await supabaseAdmin.rpc('generate_student_id', {
      p_batch_code: batchCode,
    });
    const candidate = generatedId || `ATS-${batchCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('student_unique_id', candidate)
      .limit(1);

    if (!data || data.length === 0) {
      return candidate;
    }
  }

  while (true) {
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const candidate = `ATS-${batchCode}-${randomSuffix}`;
    const { data } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('student_unique_id', candidate)
      .limit(1);
    if (!data || data.length === 0) {
      return candidate;
    }
  }
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

  function findHeaderRow(rows, keywords) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rowStr = JSON.stringify(rows[r] || []).toUpperCase();
      if (keywords.some((kw) => rowStr.includes(kw.toUpperCase()))) {
        return r;
      }
    }
    return -1;
  }

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

  // 1. MASTER BIO SHEET
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

        let studentId = null;
        let existingStudent = null;

        // Global lookup across ALL batches by email
        if (email) {
          const { data } = await supabaseAdmin
            .from('students')
            .select('id, student_unique_id, batch_id, surname, first_name')
            .eq('email', email)
            .limit(1);
          if (data && data.length > 0) existingStudent = data[0];
        }

        // Global lookup by cardNo or student_unique_id
        if (!existingStudent && cardNo) {
          const { data } = await supabaseAdmin
            .from('students')
            .select('id, student_unique_id, batch_id, surname, first_name')
            .or(`card_number.eq.${cardNo},student_unique_id.eq.${cardNo}`)
            .limit(1);
          if (data && data.length > 0) existingStudent = data[0];
        }

        // Global lookup by surname AND first_name
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

          // Check if this student is from a PREVIOUS batch -> Retake!
          if (existingStudent.batch_id !== batchId) {
            await supabaseAdmin
              .from('students')
              .update({
                batch_id: batchId,
                ...(cardNo ? { card_number: cardNo } : {}),
                ...(phone && phone !== '00000000000' ? { phone } : {}),
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

            // Update grade record comments for retake
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
          // Brand new student creation with collision fallback
          let insertSuccess = false;
          let attempts = 0;
          let preferredId = cardNo;

          while (!insertSuccess && attempts < 5) {
            attempts++;
            const studentUniqueId = await generateUniqueStudentId(batch.batch_code, preferredId);
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

  // 2. MEMBERSHIP GRADES SHEET
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

        let targetStudentId = studentCache.get(fullName.toUpperCase());
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
            let insertSuccess = false;
            let attempts = 0;
            while (!insertSuccess && attempts < 5) {
              attempts++;
              const studentUniqueId = await generateUniqueStudentId(batch.batch_code);
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

  // 3. MIT GRADES SHEET
  const mitSheetName = wb.SheetNames.find((name) =>
    /MIT/i.test(name) || /MIT-200/i.test(name)
  ) || (batch.programme_type === 'MIT' ? wb.SheetNames[0] : null);

  if (mitSheetName && (batch.programme_type === 'MIT' || /MIT/i.test(mitSheetName))) {
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

        let targetStudent = null;
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
            const studentUniqueId = await generateUniqueStudentId(batch.batch_code);
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

        if (targetStudent) {
          let { data: reg } = await supabaseAdmin
            .from('mit_registrations')
            .select('id')
            .eq('batch_id', batchId)
            .eq('membership_student_id', targetStudent.id)
            .maybeSingle();

          if (!reg) {
            // Check prior MIT registrations for retake
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

  // 4. PROCLAIMERS GRADES SHEET
  const procSheetName = wb.SheetNames.find((name) =>
    /PROCLAIMERS/i.test(name) || /PROCLAIMER/i.test(name)
  ) || (batch.programme_type === 'PROCLAIMERS' ? wb.SheetNames[0] : null);

  if (procSheetName) {
    const ws = wb.Sheets[procSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = findHeaderRow(rawRows, ['FULL NAME', 'STUDENT NAME', 'CIH', 'PROJECT', 'FINAL GRADES', 'INFLUENCE']);

    if (headerIdx !== -1) {
      const headers = rawRows[headerIdx];
      const dataRows = rawRows.slice(headerIdx + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const r = mapRow(headers, dataRows[i]);
        const fullName = toStr(r['FULL NAME'] || r['NAME'] || r['STUDENT NAME']);
        if (!fullName) continue;

        const { first_name, surname } = parseFullName(fullName);
        const department = toStr(r['DEPARTMENT']);

        let targetStudent = null;
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
            const studentUniqueId = await generateUniqueStudentId(batch.batch_code);
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
              class: toStr(r['CLASS GROUP'] || r['CLASS']),
              trainer: toStr(r['TRAINERS'] || r['TRAINER']),
              assignment: toNum(r['CIH'] || r['ASSIGNMENT']),
              attendance: toNum(r['ATTENDANCE']),
              assessment: toNum(r['ASSESSMENT']),
              presentation: toNum(r['PRESENTATION']),
              exam: toNum(r['PROJECT'] || r['EXAM']),
              final_grades: toNum(r['FINAL GRADES']),
              status: toStr(r['(RELEASED)'] || r['STATUS']),
              comments: toStr(r['COMMENTS']),
              department: department,
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

