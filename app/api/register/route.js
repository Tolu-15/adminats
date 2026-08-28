import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { batch_id, surname, first_name, email, phone, gender } = body;

    if (!batch_id || !surname || !first_name || !email || !phone || !gender || !body.date_of_birth) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Age validation — minimum 16 years based on date_of_birth
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

    // Generate student ID format: ATS-[BATCH_CODE]-NNNN  e.g. ATS-056-0001
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
    const seqStr = String(nextSeq).padStart(4, '0');
    const numMatch = (batch.batch_name || '').match(/\d+/);
    const batchTag = numMatch ? numMatch[0] : (batch.batch_name || 'ATS').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    const student_unique_id = `ATS-${batchTag}-${seqStr}`;

    // 1. Core student record
    const studentRecord = {
      student_unique_id,
      batch_id,
      surname: (body.surname || '').toUpperCase().trim(),
      first_name: (body.first_name || '').toUpperCase().trim(),
      middle_name: body.middle_name ? body.middle_name.toUpperCase().trim() : null,
      email: body.email,
      phone: body.phone,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender,
      home_address: body.home_address || null,
      local_government: body.local_government || null,
      state_of_origin: body.state_of_origin || null,
      nationality: body.nationality || null,
      education: body.education || null,
      church_join_date: body.church_join_date || null,
      challenges: body.challenges || null,
      photo_url: body.photo_url || null,
    };

    const { data: student, error: insertError } = await supabaseAdmin
      .from('students')
      .insert(studentRecord)
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Next of kin record
    if (body.next_of_kin || body.next_of_kin_phone || body.next_of_kin_address) {
      await supabaseAdmin.from('student_next_of_kin').insert({
        student_id: student.id,
        name: body.next_of_kin || null,
        relationship: body.next_of_kin_relationship || null,
        phone: body.next_of_kin_phone || null,
        address: body.next_of_kin_address || null,
      });
    }

    // 3. Spiritual profile record
    await supabaseAdmin.from('student_spiritual_profile').insert({
      student_id: student.id,
      born_again: body.born_again === 'Yes' || body.born_again === true,
      born_again_details: body.born_again_details || null,
      baptized_water: body.baptized_water === 'Yes' || body.baptized_water === true,
      baptized_water_details: body.baptized_water_details || null,
      baptized_holy_spirit: body.baptized_holy_spirit === 'Yes' || body.baptized_holy_spirit === true,
      baptized_holy_spirit_details: body.baptized_holy_spirit_details || null,
      is_first_timer: body.is_first_timer === 'Yes' || body.is_first_timer === true,
    });

    // 4. Registration record (stage: membership)
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .insert({
        student_id: student.id,
        batch_id,
        stage: 'membership',
      })
      .select()
      .single();

    if (regErr) throw regErr;

    // 5. Blank membership grades record
    await supabaseAdmin.from('membership_grades').insert({
      registration_id: reg.id,
    });

    return NextResponse.json({ student });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Registration failed.' }, { status: 500 });
  }
}
