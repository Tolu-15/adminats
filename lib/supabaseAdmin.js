import { createClient } from '@supabase/supabase-js';

// Server-only guard: prevent accidental client-side import/execution
if (typeof window !== 'undefined') {
  throw new Error('lib/supabaseAdmin.js is a server-only module and must not be imported in client-side code.');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false } }
);
