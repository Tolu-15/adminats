-- Run once in the Supabase SQL editor before using retakes and bulk grading.
-- Existing registrations and grades are retained. Previously overwritten attempts cannot be reconstructed.
begin;
create table if not exists public.registration_attempt_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  registration_id uuid not null,
  stage text not null,
  batch_id uuid,
  batch_name text,
  batch_code text,
  department text,
  started_at timestamptz,
  archived_at timestamptz not null default now(),
  grades jsonb not null default '{}'::jsonb
);
create index if not exists attempt_history_student on public.registration_attempt_history(student_id, archived_at desc);
alter table public.registration_attempt_history enable row level security;
revoke all on public.registration_attempt_history from anon, authenticated;
grant select, insert on public.registration_attempt_history to service_role;

create or replace function public.preserve_registration_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_grades jsonb;
  v_batch record;
  v_table text;
begin
  if new.student_id is distinct from old.student_id or new.stage is distinct from old.stage then
    raise exception 'A registration cannot change its student or programme. Create a new registration.';
  end if;
  if new.batch_id is not distinct from old.batch_id then return new; end if;
  if old.stage not in ('membership', 'mit', 'proclaimers') then raise exception 'Invalid programme'; end if;
  v_table := old.stage || '_grades';
  execute format('select to_jsonb(g) from public.%I g where registration_id = $1 for update', v_table) into v_grades using old.id;
  select batch_name, batch_code into v_batch from public.batches where id = old.batch_id;
  insert into public.registration_attempt_history(student_id, registration_id, stage, batch_id, batch_name, batch_code, department, started_at, grades)
  values(old.student_id, old.id, old.stage, old.batch_id, v_batch.batch_name, v_batch.batch_code, old.department, old.created_at, coalesce(v_grades, '{}'::jsonb));
  -- A fresh attempt starts with an empty grade record. The snapshot and reset are one transaction.
  execute format('delete from public.%I where registration_id = $1', v_table) using old.id;
  execute format('insert into public.%I (registration_id) values ($1)', v_table) using old.id;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.preserve_registration_attempt() from public;
drop trigger if exists preserve_registration_attempt on public.registrations;
create trigger preserve_registration_attempt before update on public.registrations
for each row execute function public.preserve_registration_attempt();

create or replace function public.save_bulk_grades(p_batch_id uuid, p_stage text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_current jsonb; v_key text; v_value jsonb;
  v_table text; v_allowed text[]; v_sets text; v_count integer := 0;
  v_registration uuid;
begin
  if p_stage is null or p_stage not in ('membership', 'mit', 'proclaimers') then raise exception 'Invalid programme'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 250 then raise exception 'Save between 1 and 250 students at a time'; end if;
  v_table := p_stage || '_grades';
  v_allowed := case p_stage
    when 'membership' then array['attendance','test','assignment','assessment','presentation','exam','final_grades','status']
    when 'mit' then array['midterm_test','interactions','bible_study','assignment','attendance','cth','community_service','evangelism','presentation','final_exam','final_grades','status']
    else array['cih','attendance','assessment','presentation','project','seminar_attendance','final_grades','status'] end;
  -- Stable lock order prevents two overlapping class saves from deadlocking.
  for v_row in select value from jsonb_array_elements(p_rows) order by value->>'registration_id' loop
    v_registration := (v_row->>'registration_id')::uuid;
    perform 1 from public.registrations r join public.students s on s.id = r.student_id join public.batches b on b.id = r.batch_id
      where r.id = v_registration and r.batch_id = p_batch_id and r.stage = p_stage and r.created_at is not distinct from (v_row->>'attempt_started_at')::timestamptz and s.deleted_at is null and b.deleted_at is null for update of r;
    if not found then raise exception 'Student registration changed or is no longer available. Reload the class.'; end if;
    execute format('select to_jsonb(g) from public.%I g where registration_id = $1 for update', v_table) into v_current using v_registration;
    v_current := coalesce(v_current, '{}'::jsonb);
    if v_row->'changes' is null or jsonb_typeof(v_row->'changes') <> 'object' or v_row->'changes' = '{}'::jsonb then raise exception 'No grade changes supplied'; end if;
    v_sets := '';
    for v_key, v_value in select key, value from jsonb_each(v_row->'changes') loop
      if not (v_key = any(v_allowed)) then raise exception 'Unsupported grade field'; end if;
      if coalesce(v_current->v_key, 'null'::jsonb) is distinct from coalesce(v_row->'expected'->v_key, 'null'::jsonb) then raise exception 'Grades changed since review. Reload the class and review again.'; end if;
      if v_key = 'status' then
        if v_value <> 'null'::jsonb and (jsonb_typeof(v_value) <> 'string' or (v_value #>> '{}') not in ('IN_PROGRESS','PASSED','FAILED','DROP') and not (p_stage = 'proclaimers' and (v_value #>> '{}') = 'RELEASED')) then raise exception 'Invalid status'; end if;
      elsif v_value <> 'null'::jsonb then
        if jsonb_typeof(v_value) <> 'number' then raise exception 'Scores must be numeric'; end if;
        if trunc((v_value #>> '{}')::numeric) <> (v_value #>> '{}')::numeric or (v_value #>> '{}')::numeric < 0 or (v_key = 'final_grades' and (v_value #>> '{}')::numeric > 100) then raise exception 'Score outside allowed range'; end if;
      end if;
      v_sets := v_sets || case when v_sets = '' then '' else ', ' end || format('%I = (jsonb_populate_record(null::public.%I, $1)).%I', v_key, v_table, v_key);
    end loop;
    execute format('insert into public.%I (registration_id) values ($1) on conflict (registration_id) do nothing', v_table) using v_registration;
    execute format('update public.%I set %s, updated_at = now() where registration_id = $2', v_table, v_sets) using v_row->'changes', v_registration;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.save_bulk_grades(uuid, text, jsonb) from public;
grant execute on function public.save_bulk_grades(uuid, text, jsonb) to service_role;

-- Atomically move the current registration, preserve its previous attempt via the trigger,
-- reset grades, and update Membership's home batch. Concurrent duplicate submissions fail.
create or replace function public.start_programme_attempt(
  p_student_id uuid, p_batch_id uuid, p_stage text,
  p_expected_registration_id uuid default null, p_expected_batch_id uuid default null,
  p_department text default null
) returns uuid language plpgsql security definer set search_path = public as $
declare
  v_reg public.registrations%rowtype;
  v_student public.students%rowtype;
  v_prior_stage text; v_status text; v_prior_id uuid;
  v_table text; v_id uuid;
begin
  if p_stage is null or p_stage not in ('membership','mit','proclaimers') then raise exception 'Invalid programme'; end if;
  select * into v_student from public.students where id = p_student_id and deleted_at is null for update;
  if not found then raise exception 'Student not found'; end if;
  perform 1 from public.batches where id = p_batch_id and deleted_at is null and is_active = true for share;
  if not found then raise exception 'Batch is not open for registration'; end if;
  if p_stage = 'proclaimers' and coalesce(trim(p_department), '') = '' then raise exception 'Department is required'; end if;
  if p_stage <> 'membership' then
    foreach v_prior_stage in array (case when p_stage = 'mit' then array['membership'] else array['membership','mit'] end) loop
      select id into v_prior_id from public.registrations where student_id = p_student_id and stage = v_prior_stage;
      v_status := null;
      if v_prior_id is not null then execute format('select status from public.%I where registration_id = $1', v_prior_stage || '_grades') into v_status using v_prior_id; end if;
      if upper(trim(coalesce(v_status,''))) <> 'PASSED' then raise exception 'Previous programme has not been passed'; end if;
    end loop;
  end if;
  select * into v_reg from public.registrations where student_id = p_student_id and stage = p_stage for update;
  if v_reg.id is distinct from p_expected_registration_id or (v_reg.id is not null and v_reg.batch_id is distinct from p_expected_batch_id) then raise exception 'Registration changed. Reload and try again.'; end if;
  if v_reg.id is not null and v_reg.batch_id = p_batch_id then raise exception 'Student is already registered in this batch. No grades were reset.'; end if;
  v_table := p_stage || '_grades';
  if v_reg.id is not null and p_stage = 'membership' then
    execute 'select status from public.membership_grades where registration_id = $1 for update' into v_status using v_reg.id;
    if upper(trim(coalesce(v_status,''))) = 'PASSED' then raise exception 'Membership already passed. Register for MIT instead.'; end if;
  end if;
  if v_reg.id is null then
    insert into public.registrations(student_id, batch_id, stage, department) values(p_student_id, p_batch_id, p_stage, nullif(trim(p_department),'')) returning id into v_id;
    execute format('insert into public.%I (registration_id) values ($1) on conflict (registration_id) do nothing', v_table) using v_id;
  else
    update public.registrations set batch_id = p_batch_id, department = nullif(trim(p_department),'') where id = v_reg.id returning id into v_id;
  end if;
  if p_stage = 'membership' then update public.students set batch_id = p_batch_id where id = p_student_id; end if;
  if p_stage = 'mit' then update public.mit_grades set first_timer_date = v_student.church_join_date where registration_id = v_id; end if;
  return v_id;
end;
$;
revoke all on function public.start_programme_attempt(uuid,uuid,text,uuid,uuid,text) from public;
grant execute on function public.start_programme_attempt(uuid,uuid,text,uuid,uuid,text) to service_role;

create or replace function public.ats_workflow_features()
returns boolean language sql security definer set search_path = public as $
  select exists(select 1 from pg_trigger where tgrelid = 'public.registrations'::regclass and tgname = 'preserve_registration_attempt' and tgenabled <> 'D');
$;
revoke all on function public.ats_workflow_features() from public;
grant execute on function public.ats_workflow_features() to service_role;
notify pgrst, 'reload schema';
commit;
