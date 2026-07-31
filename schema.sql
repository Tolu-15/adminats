-- ============================================================
-- ATS Membership App — Supabase schema
-- Run this whole file once in Supabase SQL editor.
-- NOTE: If updating an existing DB, only run the sections marked [NEW].
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- BATCHES ----------
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,        -- e.g. "056"
  batch_name text not null,               -- e.g. "Batch 056"
  reg_token text not null unique,         -- random slug used in the public link
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- STUDENTS ----------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_unique_id text not null unique, -- e.g. ATS-2026-0001
  batch_id uuid not null references batches(id) on delete restrict,

  surname text not null,
  first_name text not null,
  middle_name text,
  email text not null,
  phone text not null,
  date_of_birth date,
  gender text check (gender in ('Male','Female')),
  home_address text,
  next_of_kin text,
  next_of_kin_address text,
  state_of_origin text,
  nationality text,
  education text check (education in (
    'Basic School Leaving Certificate',
    'Secondary School Leaving Certificate',
    'Tertiary Education Degree and above'
  )),
  born_again text check (born_again in ('Yes','No','Maybe')),
  born_again_details text,
  baptized_water boolean,
  baptized_water_details text,
  baptized_holy_spirit boolean,
  baptized_holy_spirit_details text,
  church_join_date text,
  is_first_timer text default 'Yes',
  challenges text,
  photo_url text,

  created_at timestamptz not null default now()
);

create index if not exists idx_students_batch on students(batch_id);

-- ---------- UNIQUE STUDENT ID GENERATOR ----------
create sequence if not exists student_id_seq start 1;

-- Updated: accepts batch_code so IDs are formatted ATS-[BATCH_CODE]-NNNN
-- e.g. ATS-055-0001
create or replace function generate_student_id(p_batch_code text)
returns text
language plpgsql
as $$
declare
  next_val int;
  candidate text;
  exists_already boolean;
begin
  loop
    next_val := nextval('student_id_seq');
    candidate := 'ATS-' || p_batch_code || '-' || lpad(next_val::text, 4, '0');
    select count(*) > 0 into exists_already from students where student_unique_id = candidate;
    if not exists_already then
      return candidate;
    end if;
  end loop;
end;
$$;

-- ---------- ROW LEVEL SECURITY ----------
alter table batches enable row level security;
alter table students enable row level security;

-- Public (anon) can read active batches only, to validate a registration link
drop policy if exists "public can read active batches" on batches;
create policy "public can read active batches" on batches
  for select using (is_active = true);

-- Only authenticated admins can create/update/delete batches
drop policy if exists "admins manage batches" on batches;
create policy "admins manage batches" on batches
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Students table: no public access at all.
-- Registrations are written by the server using the SERVICE ROLE key
-- (which bypasses RLS), never directly from the browser.
drop policy if exists "admins read students" on students;
create policy "admins read students" on students
  for select using (auth.role() = 'authenticated');

-- ---------- STORAGE BUCKET FOR PHOTOS ----------
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- Allow public uploads to this bucket (registration form uploads before we
-- have an admin session). Reads are public since it's a photo bucket.
drop policy if exists "public upload student photos" on storage.objects;
create policy "public upload student photos" on storage.objects
  for insert with check (bucket_id = 'student-photos');

drop policy if exists "public read student photos" on storage.objects;
create policy "public read student photos" on storage.objects
  for select using (bucket_id = 'student-photos');

-- ============================================================
-- After running this, go to Authentication > Users in Supabase
-- and manually create your admin login(s) (email + password).
-- ============================================================

-- ============================================================
-- [NEW] STUDENT GRADES TABLE
-- Run this block separately if the DB already exists.
-- ============================================================

create table if not exists student_grades (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade unique,

  -- Grouping info (filled via Excel or inline edit)
  class           text,                      -- e.g. "A", "B", "C"
  trainer         text,                      -- trainer name

  -- Scores
  attendance      int,
  test            int,
  assignment      int,
  assessment      int,
  presentation    int,
  exam            int,
  final_grades    int,

  -- Status fields
  water_baptism         text,               -- "YES" / "NO"
  holy_spirit_baptism   text,               -- "YES" / "NO"
  portal                text,               -- portal status text
  status                text,               -- "PASSED" / "FAILED"
  comments              text,
  covenant_deed         text,               -- "SIGNED" / ""

  updated_at      timestamptz not null default now()
);

create index if not exists idx_grades_student on student_grades(student_id);

-- RLS: only authenticated admins can read/write grades
alter table student_grades enable row level security;

drop policy if exists "admins manage grades" on student_grades;
create policy "admins manage grades" on student_grades
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- [NEW] MULTI-PROGRAMME ADDITIONS
-- Run this block separately if the DB already exists.
-- ============================================================

-- 1. Add card_number to students (physical membership card)
alter table students add column if not exists card_number text;
create unique index if not exists idx_students_card_number on students(card_number) where card_number is not null;

-- 2. Add programme_type to batches
--    Values: 'MEMBERSHIP' (default), 'MIT', 'PROCLAIMERS'
alter table batches add column if not exists programme_type text not null default 'MEMBERSHIP';

-- 3. MIT REGISTRATIONS TABLE
--    Links a membership student to an MIT batch.
create table if not exists mit_registrations (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references batches(id) on delete restrict,
  membership_student_id uuid not null references students(id) on delete restrict,
  department            text,
  created_at            timestamptz not null default now(),
  unique(batch_id, membership_student_id)  -- prevent double registration in same MIT batch
);

create index if not exists idx_mit_reg_batch   on mit_registrations(batch_id);
create index if not exists idx_mit_reg_student on mit_registrations(membership_student_id);

alter table mit_registrations enable row level security;
drop policy if exists "admins manage mit_registrations" on mit_registrations;
create policy "admins manage mit_registrations" on mit_registrations
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. MIT GRADES TABLE
--    All score columns from the MIT grade sheet image.
create table if not exists mit_grades (
  id                        uuid primary key default gen_random_uuid(),
  mit_registration_id       uuid not null references mit_registrations(id) on delete cascade unique,

  -- Grouping
  class                     text,
  trainer                   text,

  -- Scores
  midterm_test              int,
  interactions              int,
  bible_study               int,
  assignment                int,
  attendance                int,
  cth                       int,
  community_service         int,
  evangelism                int,
  presentation              int,
  final_exam                int,
  final_grades              int,

  -- Status / narrative
  status                    text,               -- PASSED / FAILED
  comments                  text,
  department                text,               -- can be overridden from registration
  department_confirmation   text,               -- YES / NO
  first_timer               text,               -- YES / NO
  first_timer_date          date,               -- pulled from students.church_join_date

  updated_at                timestamptz not null default now()
);

create index if not exists idx_mit_grades_reg on mit_grades(mit_registration_id);

alter table mit_grades enable row level security;
drop policy if exists "admins manage mit_grades" on mit_grades;
create policy "admins manage mit_grades" on mit_grades
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- [NEW] PROCLAIMERS ADDITIONS
-- Run this block separately if the DB already exists.
-- ============================================================

-- 5. PROCLAIMERS REGISTRATIONS TABLE
create table if not exists proclaimers_registrations (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references batches(id) on delete restrict,
  membership_student_id uuid not null references students(id) on delete restrict,
  department            text not null,
  created_at            timestamptz not null default now(),
  unique(batch_id, membership_student_id)
);

create index if not exists idx_proclaimers_reg_batch   on proclaimers_registrations(batch_id);
create index if not exists idx_proclaimers_reg_student on proclaimers_registrations(membership_student_id);

alter table proclaimers_registrations enable row level security;
drop policy if exists "admins manage proclaimers_registrations" on proclaimers_registrations;
create policy "admins manage proclaimers_registrations" on proclaimers_registrations
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 6. PROCLAIMERS GRADES TABLE
create table if not exists proclaimers_grades (
  id                          uuid primary key default gen_random_uuid(),
  proclaimers_registration_id uuid not null references proclaimers_registrations(id) on delete cascade unique,

  class                       text,
  trainer                     text,
  attendance                  int,
  assignment                  int,
  assessment                  int,
  presentation                int,
  exam                        int,
  final_grades                int,

  status                      text,               -- PASSED / FAILED
  comments                    text,
  department                  text,

  updated_at                  timestamptz not null default now()
);

create index if not exists idx_proclaimers_grades_reg on proclaimers_grades(proclaimers_registration_id);

alter table proclaimers_grades enable row level security;
drop policy if exists "admins manage proclaimers_grades" on proclaimers_grades;
create policy "admins manage proclaimers_grades" on proclaimers_grades
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- [NEW] FIRST TIMER COLUMN MIGRATION
-- Run this single line if your database already exists:
-- ============================================================
alter table students add column if not exists is_first_timer text default 'Yes';


-- ============================================================
-- RETAKE SYSTEM NOTES
-- ============================================================
-- No new DB columns are required for the retake feature.
-- The retake approach works as follows:
--
-- MEMBERSHIP RETAKE:
--   1. Student searches by existing student_unique_id or card_number.
--   2. API /api/membership/retake updates students.batch_id to the new batch.
--   3. The student_grades row is RESET (grades cleared) with a comments field
--      starting with "RETAKE —" — this is used for detection in the admin UI.
--
-- MIT RETAKE:
--   1. MIT lookup returns isRetake=true + priorAttempts[] if the student has
--      previous mit_registrations rows.
--   2. /api/mit/register always allows a new row per batch (no global block).
--   3. A new mit_grades row is created with comments starting "RETAKE —".
--
-- PROCLAIMERS RETAKE:
--   Handled the same as MIT — a student can have multiple proclaimers_registrations
--   across different batches, each with their own grade record.
--
-- ADMIN DETECTION:
--   Student profile checks memGrades.comments and mitGrades.comments for "RETAKE"
--   prefix to display the 🔄 Retake badge on the profile card.
-- ============================================================




