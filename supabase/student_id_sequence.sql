-- Run this once in the Supabase SQL editor.
-- It moves public registration ID generation into Postgres so concurrent signups
-- cannot read the same max value and issue duplicate student_unique_id values.

create table if not exists public.batch_student_sequences (
  batch_id uuid primary key references public.batches(id) on delete cascade,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.generate_student_id(p_batch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_label text;
  batch_tag text;
  seq_value bigint;
begin
  select coalesce(batch_code, batch_name, 'ATS')
    into batch_label
  from public.batches
  where id = p_batch_id;

  batch_tag := substring(coalesce(batch_label, 'ATS') from '[0-9]+');
  if batch_tag is null or batch_tag = '' then
    batch_tag := upper(left(regexp_replace(coalesce(batch_label, 'ATS'), '[^a-zA-Z0-9]', '', 'g'), 6));
  end if;
  if batch_tag is null or batch_tag = '' then
    batch_tag := 'ATS';
  end if;

  insert into public.batch_student_sequences (batch_id, last_value)
  select
    p_batch_id,
    coalesce(max((regexp_match(student_unique_id, '([0-9]+)$'))[1]::bigint), 0) + 1
  from public.students
  where batch_id = p_batch_id
  on conflict (batch_id)
  do update set
    last_value = public.batch_student_sequences.last_value + 1,
    updated_at = now()
  returning last_value into seq_value;

  return 'ATS-' || batch_tag || '-' || lpad(seq_value::text, 4, '0');
end;
$$;

grant execute on function public.generate_student_id(uuid) to anon, authenticated, service_role;
