import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { appendStudentToSheet } from '../../../lib/googleSheets';

export async function POST(request) {
  try {
    const body = await request.json();
    const { batch_id, surname, first_name, email, phone, gender } = body;

    if (!batch_id || !surname || !first_name || !email || !phone || !gender || !body.date_of_birth) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Age validation — minimum 16 years based on date_of_birth (when provided)
    if (body.date_of_birth) {
      const today = new Date();
      const dob = new Date(body.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 16) {
        return NextResponse.json(
          { error: 'Registrant must be at least 16 years old to join Membership.' },
          { status: 400 }
        );
      }
    }

    // Confirm batch exists and is active
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('id', batch_id)
      .eq('is_active', true)
      .maybeSingle();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Invalid or inactive batch.' }, { status: 400 });
    }

    // Generate student ID starting from 0001 for EACH batch
    // Format: ATS-[BATCH_CODE]-NNNN  e.g. ATS-056-0001
    const { data: existingStudents } = await supabaseAdmin
      .from('students')
      .select('student_unique_id')
      .eq('batch_id', batch_id);

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
    const numMatch = (batch.batch_name || '').match(/\d+/);
    const batchTag = numMatch ? numMatch[0] : (batch.batch_name || 'ATS').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    const student_unique_id = `ATS-${batchTag}-${seqStr}`;

    const record = {
      student_unique_id,
      batch_id,
      surname: body.surname,
      first_name: body.first_name,
      middle_name: body.middle_name || null,
      email: body.email,
      phone: body.phone,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender,
      is_first_timer: body.is_first_timer === 'Yes',
      home_address: body.home_address || null,
      next_of_kin: body.next_of_kin || null,
      next_of_kin_relationship: body.next_of_kin_relationship || null,
      next_of_kin_phone: body.next_of_kin_phone || null,
      state_of_origin: body.state_of_origin || null,
      local_government: body.local_government || null,
      nationality: body.nationality || null,
      education: body.education || null,
      born_again: body.born_again || null,
      born_again_details: body.born_again_details || null,
      baptized_water: body.baptized_water === 'Yes',
      baptized_water_details: body.baptized_water_details || null,
      baptized_holy_spirit: body.baptized_holy_spirit === 'Yes',
      baptized_holy_spirit_details: body.baptized_holy_spirit_details || null,
      church_join_date: body.church_join_date || null,
      challenges: body.challenges || null,
      photo_url: body.photo_url || null,
    };

    let { data: student, error: insertError } = await supabaseAdmin
      .from('students')
      .insert(record)
      .select()
      .single();

    // Fallback if Supabase database doesn't have the 3 new columns yet
    if (insertError && (insertError.message?.includes('column') || insertError.code === 'PGRST204' || insertError.message?.includes('schema'))) {
      console.warn('Supabase DB missing new columns, retrying insert with legacy schema compatibility:', insertError.message);
      const legacyRecord = { ...record };
      delete legacyRecord.local_government;
      delete legacyRecord.next_of_kin_relationship;
      delete legacyRecord.next_of_kin_phone;

      // Preserve next of kin relationship/phone inside next_of_kin_address
      if (record.next_of_kin_relationship || record.next_of_kin_phone) {
        legacyRecord.next_of_kin_address = [
          record.next_of_kin_relationship ? `Rel: ${record.next_of_kin_relationship}` : null,
          record.next_of_kin_phone ? `Phone: ${record.next_of_kin_phone}` : null,
        ].filter(Boolean).join(' | ');
      }

      const res2 = await supabaseAdmin
        .from('students')
        .insert(legacyRecord)
        .select()
        .single();

      if (res2.error) throw res2.error;
      student = res2.data;
    } else if (insertError) {
      throw insertError;
    }

    // Sync to Google Sheets — don't fail registration if this errors,
    // just log it, since the source of truth is Supabase.
    try {
      await appendStudentToSheet(student, batch.batch_name);
    } catch (sheetErr) {
      console.error('Google Sheets sync failed:', sheetErr.message);
    }

    return NextResponse.json({ student });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Registration failed.' }, { status: 500 });
  }
}
