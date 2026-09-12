-- Run this in the Supabase SQL Editor.
-- This function wraps student registration into an atomic PostgreSQL transaction.
-- If any insert fails, all changes are rolled back automatically, preventing orphaned records.

create or replace function public.create_student_full(
  p_student jsonb,
  p_next_of_kin jsonb default null,
  p_spiritual jsonb default null,
  p_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_reg record;
begin
  -- 1. Insert core student record
  insert into public.students (
    student_unique_id,
    batch_id,
    surname,
    first_name,
    middle_name,
    email,
    phone,
    date_of_birth,
    gender,
    home_address,
    local_government,
    state_of_origin,
    nationality,
    education,
    church_join_date,
    challenges,
    photo_url
  ) values (
    p_student->>'student_unique_id',
    (p_student->>'batch_id')::uuid,
    p_student->>'surname',
    p_student->>'first_name',
    p_student->>'middle_name',
    p_student->>'email',
    p_student->>'phone',
    case when p_student->>'date_of_birth' is not null and p_student->>'date_of_birth' != ''
      then (p_student->>'date_of_birth')::date else null end,
    p_student->>'gender',
    p_student->>'home_address',
    p_student->>'local_government',
    p_student->>'state_of_origin',
    p_student->>'nationality',
    p_student->>'education',
    case when p_student->>'church_join_date' is not null and p_student->>'church_join_date' != ''
      then (p_student->>'church_join_date')::date else null end,
    p_student->>'challenges',
    p_student->>'photo_url'
  )
  returning * into v_student;

  -- 2. Insert next of kin record (if provided)
  if p_next_of_kin is not null and (
    p_next_of_kin->>'name' is not null or
    p_next_of_kin->>'phone' is not null or
    p_next_of_kin->>'address' is not null or
    p_next_of_kin->>'relationship' is not null
  ) then
    insert into public.student_next_of_kin (
      student_id,
      name,
      relationship,
      phone,
      address
    ) values (
      v_student.id,
      p_next_of_kin->>'name',
      p_next_of_kin->>'relationship',
      p_next_of_kin->>'phone',
      p_next_of_kin->>'address'
    );
  end if;

  -- 3. Insert spiritual profile record
  if p_spiritual is not null then
    insert into public.student_spiritual_profile (
      student_id,
      born_again,
      born_again_details,
      baptized_water,
      baptized_water_details,
      baptized_holy_spirit,
      baptized_holy_spirit_details,
      is_first_timer
    ) values (
      v_student.id,
      case when p_spiritual->>'born_again' is not null then (p_spiritual->>'born_again')::boolean else null end,
      p_spiritual->>'born_again_details',
      case when p_spiritual->>'baptized_water' is not null then (p_spiritual->>'baptized_water')::boolean else null end,
      p_spiritual->>'baptized_water_details',
      case when p_spiritual->>'baptized_holy_spirit' is not null then (p_spiritual->>'baptized_holy_spirit')::boolean else null end,
      p_spiritual->>'baptized_holy_spirit_details',
      case when p_spiritual->>'is_first_timer' is not null then (p_spiritual->>'is_first_timer')::boolean else null end
    );
  end if;

  -- 4. Insert membership registration
  insert into public.registrations (
    student_id,
    batch_id,
    stage
  ) values (
    v_student.id,
    coalesce(p_batch_id, (p_student->>'batch_id')::uuid),
    'membership'
  )
  returning * into v_reg;

  -- 5. Insert blank membership grades row
  insert into public.membership_grades (
    registration_id
  ) values (
    v_reg.id
  );

  return to_jsonb(v_student);
end;
$$;

grant execute on function public.create_student_full(jsonb, jsonb, jsonb, uuid) to anon, authenticated, service_role;
