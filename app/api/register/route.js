import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getClientIp, verifyTurnstileToken } from '../../../lib/turnstile';
import { validateStudentData, sanitizeDate } from '../../../lib/validators';

async function generateStudentUniqueId(batchId) {
  const attempts = [
    { name: 'generate_student_id', args: { p_batch_id: batchId } },
    { name: 'generate_student_id', args: { batch_id: batchId } },
    { name: 'generate_student_id', args: {} },
    { name: 'generate_student_unique_id', args: { p_batch_id: batchId } },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabaseAdmin.rpc(attempt.name, attempt.args);
    if (!error && data) return data;
  }

  throw new Error('Student ID generator is not configured in the database. Run supabase/student_id_sequence.sql before accepting registrations.');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { batch_id, surname, first_name, email, phone, gender } = body;

    const turnstile = await verifyTurnstileToken(body.turnstileToken, getClientIp(request));
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 });
    }

    // Input validation: email format, phone format, and field length limits
    const validation = validateStudentData(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0], errors: validation.errors }, { status: 400 });
    }

    if (!body.date_of_birth) {
      return NextResponse.json({ error: 'Date of birth is required.' }, { status: 400 });
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

    const student_unique_id = await generateStudentUniqueId(batch_id);

    // 1. Core student record
    const studentRecord = {
      student_unique_id,
      batch_id,
      surname: (body.surname || '').toUpperCase().trim(),
      first_name: (body.first_name || '').toUpperCase().trim(),
      middle_name: body.middle_name ? body.middle_name.toUpperCase().trim() : null,
      email: body.email,
      phone: body.phone,
      date_of_birth: sanitizeDate(body.date_of_birth),
      gender: body.gender,
      home_address: body.home_address || null,
      local_government: body.local_government || null,
      state_of_origin: body.state_of_origin || null,
      nationality: body.nationality || null,
      education: body.education || null,
      church_join_date: sanitizeDate(body.church_join_date),
      challenges: body.challenges || null,
      photo_url: body.photo_url || null,
    };

    const nextOfKinPayload = (body.next_of_kin || body.next_of_kin_phone || body.next_of_kin_address || body.next_of_kin_relationship) ? {
      name: body.next_of_kin || null,
      relationship: body.next_of_kin_relationship || null,
      phone: body.next_of_kin_phone || null,
      address: body.next_of_kin_address || null,
    } : null;

    const spiritualPayload = {
      born_again: body.born_again === 'Yes' || body.born_again === true,
      born_again_details: body.born_again_details || null,
      baptized_water: body.baptized_water === 'Yes' || body.baptized_water === true,
      baptized_water_details: body.baptized_water_details || null,
      baptized_holy_spirit: body.baptized_holy_spirit === 'Yes' || body.baptized_holy_spirit === true,
      baptized_holy_spirit_details: body.baptized_holy_spirit_details || null,
      is_first_timer: body.is_first_timer === 'Yes' || body.is_first_timer === true,
    };

    // Attempt atomic write via PostgreSQL RPC transaction
    const { data: rpcStudent, error: rpcError } = await supabaseAdmin.rpc('create_student_full', {
      p_student: studentRecord,
      p_next_of_kin: nextOfKinPayload,
      p_spiritual: spiritualPayload,
      p_batch_id: batch_id,
    });

    if (!rpcError && rpcStudent) {
      return NextResponse.json({ student: rpcStudent });
    }

    // If error is anything other than missing function (PGRST202), rethrow
    if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.toLowerCase().includes('could not find function')) {
      throw rpcError;
    }

    // Fallback: If RPC is not yet created in the database, execute writes with compensating rollback
    let createdStudent = null;
    try {
      const { data: student, error: insertError } = await supabaseAdmin
        .from('students')
        .insert(studentRecord)
        .select()
        .single();

      if (insertError) throw insertError;
      createdStudent = student;

      if (nextOfKinPayload) {
        await supabaseAdmin.from('student_next_of_kin').insert({
          student_id: student.id,
          ...nextOfKinPayload,
        });
      }

      await supabaseAdmin.from('student_spiritual_profile').insert({
        student_id: student.id,
        ...spiritualPayload,
      });

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

      await supabaseAdmin.from('membership_grades').insert({
        registration_id: reg.id,
      });

      return NextResponse.json({ student: createdStudent });
    } catch (fallbackErr) {
      // Compensating rollback: delete partially created student to prevent orphaned rows
      if (createdStudent?.id) {
        try {
          await supabaseAdmin.from('students').delete().eq('id', createdStudent.id);
        } catch (cleanupErr) {
          console.error('[registration-cleanup-error]', cleanupErr);
        }
      }
      throw fallbackErr;
    }
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Registration failed.' }, { status: 500 });
  }
}
