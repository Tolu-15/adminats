# ATS Membership Registration App

Replaces the Microsoft Form with a full system:

- Admin creates a **batch** (e.g. "Batch 056") → gets a unique registration link
- Students register via that link → a **profile** is auto-created with a **unique Student ID** (e.g. `ATS-2026-0001`) and an optional **photo**
- Every registration is saved to **Supabase** (database of record) and synced to a **Google Sheet**
- Admin dashboard lists batches, students per batch, and full student profiles

## 1. Supabase setup

1. Open your Supabase project → **SQL Editor** → paste and run everything in `schema.sql`.
   This creates the `batches` and `students` tables, the unique-ID generator, Row Level
   Security policies, and a public `student-photos` storage bucket.
2. Go to **Authentication → Users** and manually create your admin login(s) (email + password).
   These are the only accounts that can sign in to `/admin`.
3. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-only)

## 2. Google Sheets sync setup

1. In Google Cloud Console, create a project (or reuse one) → enable the **Google Sheets API**.
2. Create a **Service Account** → generate a JSON key.
3. From the JSON, copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `private_key` →
   `GOOGLE_PRIVATE_KEY` (keep the `\n` characters as literal text, wrapped in quotes).
4. Create (or open) the Google Sheet you want registrations to land in. Share it with the
   service account's email address, giving it **Editor** access.
5. Copy the Sheet ID from its URL (`https://docs.google.com/spreadsheets/d/THIS_PART/edit`)
   into `GOOGLE_SHEET_ID`.
6. Add a tab named `Registrations` (or set `GOOGLE_SHEET_TAB_NAME` to whatever you name it),
   and optionally paste the header row from `lib/googleSheets.js` (`SHEET_HEADER_ROW`) as row 1.

If these env vars are left unset, the app still works — it just skips the Sheets sync and
logs a warning, since Supabase is always the source of truth.

## 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in every value from steps 1–2.

## 4. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/admin/login` to sign in as admin.

## 5. Deploy

Push this project to GitHub and deploy on **Vercel** (recommended for Next.js):

1. Import the repo in Vercel.
2. Add all variables from `.env.local` in Project Settings → Environment Variables.
3. Set `NEXT_PUBLIC_BASE_URL` to your production URL once you have it.
4. Deploy.

## How the flow works

1. **Admin creates a batch** on `/admin` (e.g. code `056`, name "Batch 056"). This generates
   a random link token and stores it as `reg_token`. The shareable link is:
   `https://yourapp.com/register/<reg_token>`
2. **A student opens that link**, fills in their biodata, optionally uploads a photo
   (uploaded straight to Supabase Storage), and submits.
3. The `/api/register` route (server-side, using the Supabase **service role** key):
   - validates the batch is active
   - calls the `generate_student_id()` Postgres function to atomically issue a unique ID
   - inserts the student record
   - appends a row to the configured Google Sheet
4. The student sees their unique Student ID as confirmation.
5. Admins browse `/admin` → batch → student profile, including the uploaded photo.

## Notes / next steps you may want

- Admin auth here is Supabase email/password via the client SDK — enough for a small team.
  For stricter protection, add Supabase's `@supabase/ssr` middleware to gate `/admin/*` at
  the edge as well.
- `student_unique_id` format is `ATS-<year>-<0001>`; edit `generate_student_id()` in
  `schema.sql` if you want a different pattern.
- To deactivate a batch's link, set `is_active = false` on that row in Supabase (or add a
  toggle button in the dashboard — the API/schema already support it).
