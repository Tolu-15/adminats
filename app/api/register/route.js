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

    // Generate the unique student ID atomically via Postgres sequence
    // Format: ATS-[BATCH_CODE]-NNNN  e.g. ATS-055-0001
    const { data: idData, error: idError } = await supabaseAdmin.rpc('generate_student_id', {
      p_batch_code: batch.batch_code,
    });
    if (idError) throw idError;
    const student_unique_id = idData;

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
      home_address: body.home_address || null,
      next_of_kin: body.next_of_kin || null,
      next_of_kin_address: body.next_of_kin_address || null,
      state_of_origin: body.state_of_origin || null,
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

    const { data: student, error: insertError } = await supabaseAdmin
      .from('students')
      .insert(record)
      .select()
      .single();

    if (insertError) throw insertError;

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
