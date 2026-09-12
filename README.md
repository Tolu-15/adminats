<<<<<<< HEAD
# ATS  Registration & Administration App

A full-featured membership registration, grading, and administrative management platform built with Next.js, Supabase, Cloudflare R2, and Cloudflare Turnstile.

Replaces paper and Microsoft Form workflows with an end-to-end automated system:
- **Batch Management**: Admins create batches (Membership, MIT, Proclaimers) and receive unique, branded registration links.
- **Public Registration**: Students register online with client-side image compression, Turnstile bot protection, and atomic profile creation.
- **Unique Student ID Generation**: Generates sequential, collision-free identifiers (e.g., `ATS-2026-0001`) via Postgres RPC.
- **Academic Grading & Transcripts**: Track attendance, assignments, assessments, exams, and completion status across programmes.
- **Data Export & Import**: Export batch records to Excel (`.xlsx`) with secure RFC 5987 headers; bulk import student and grade data with schema validation.
- **Edge Security & Audit Trail**: Edge middleware guards `/admin/*` routes; every administrative edit and deletion is tracked in `audit_logs`.

---

## 1. Environment Variables Reference

Create a `.env.local` file in the root directory:

| Variable | Required | Scope | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Client/Server | Supabase Project URL (e.g. `https://xyz.supabase.co`) |
| `SUPABASE_URL` | Optional | Server-only | Optional server-side Supabase URL override |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Client/Server | Supabase anonymous public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server-only | Supabase service-role secret key for administrative operations |
| `R2_ENDPOINT` | **Yes** | Server-only | Cloudflare R2 S3 API endpoint URL |
| `R2_ACCESS_KEY_ID` | **Yes** | Server-only | Cloudflare R2 API Access Key ID |
| `R2_SECRET_ACCESS_KEY` | **Yes** | Server-only | Cloudflare R2 API Secret Access Key |
| `R2_BUCKET_NAME` | **Yes** | Server-only | Cloudflare R2 bucket name for storing student photos |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | **Yes** | Client/Server | Public CDN URL for student photos (e.g. `https://pub-xyz.r2.dev`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`| **Yes** | Client/Server | Cloudflare Turnstile widget site key |
| `TURNSTILE_SECRET_KEY` | **Yes** | Server-only | Cloudflare Turnstile secret key for server-side verification |
| `NEXT_PUBLIC_ENABLE_TURNSTILE_LOCAL` | Optional | Client/Server | Set to `true` to force Turnstile captcha evaluation in local dev |
| `NEXT_PUBLIC_BASE_URL` | Optional | Client/Server | Public application URL (e.g. `https://membership.atscentre.org`) |
| 

## 2. Database Setup & Migrations

All SQL migrations are idempotent and can be executed via the **Supabase SQL Editor**:

1. **`schema.sql`**
   - Core tables: `batches`, `students`, `registrations`, `membership_grades`, `mit_grades`, `proclaimers_grades`, `student_next_of_kin`, `student_spiritual_profile`.
   - Initial RLS policies and table indices.

2. **`supabase/student_id_sequence.sql`**
   - Atomic student sequence counter table (`batch_student_sequences`).
   - `generate_student_id(p_batch_id uuid)` Postgres function to eliminate signup race conditions.

3. **`supabase/create_student_full.sql`**
   - Atomic transactional student registration RPC function (`create_student_full`).
   - Ensures student biodata, next-of-kin, spiritual profile, and initial stage registration succeed or fail together.

4. **`supabase/audit_log_and_soft_delete.sql`**
   - Creates the `audit_logs` table and RLS policies.
   - Adds `deleted_at` soft-delete timestamp columns to `students` and `batches` with indexing.

---

## 3. Local Development & Scripts

### Prerequisites
- Node.js 18+ (tested on Node.js 20 LTS)
- npm

### Installation & Execution

```bash
# Install dependencies
npm install

# Start local Next.js dev server on localhost:3000
npm run dev

# Run automated unit & regression tests
npm test

# Build production bundle
npm run build

# Start production server
npm start
```

---

## 4. Security Architecture & Controls

- **Edge Middleware (`middleware.js`)**: Evaluates incoming requests to `/admin/*` at the edge; unauthenticated sessions are immediately redirected to `/admin/login?next=...` before any admin assets are served.
- **Role Guard Fallbacks**: `useAdminGuard` defaults unassigned users to `'viewer'` (least privileged access), never `'admin'`.
- **Atomic Multi-Step Writes**: Registration operations use transactional Postgres functions to prevent partial failure orphans.
- **Server-Side Validation**: All incoming biodata is strictly validated via `lib/validators.js` (email RFC format, E.164 phone formats, and maximum field length constraints).
- **PostgREST Injection Protection**: User search queries are sanitized before being interpolated into PostgREST `.or()` filters.
- **RFC 5987 Export Headers**: Student roster downloads encode filenames with `filename*=UTF-8''...` to eliminate header injection attacks.
- **Restricted Image Proxy**: Next.js image optimization is restricted to configured R2 hostnames, preventing SSRF attacks.
- **Audit Logging (`lib/auditLog.js`)**: Admin mutations (`STUDENT_UPDATE`, `STUDENT_DELETE`, `BATCH_DELETE`, `GRADE_UPDATE`) record non-blocking audit entries capturing the actor, entity, timestamp, and metadata.
- **Soft Deletion**: Records support soft-deletion (`deleted_at`), with graceful fallback to cascade cleanup.

---

## 5. Production Deployment (Vercel)

1. Connect the Git repository to **Vercel**.
2. Configure the environment variables from the table above in **Project Settings → Environment Variables**.
3. Set `NEXT_PUBLIC_BASE_URL` to your production domain.
4. Deploy the main branch.
=======

>>>>>>> 1b5d22eca1dda36064004e326f64eae7c24b8da6
