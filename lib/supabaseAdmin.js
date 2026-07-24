import { createClient } from '@supabase/supabase-js';

// SERVER ONLY. Never import this file into a client component.
// The service role key bypasses Row Level Security, so registration
// submissions can be written safely without exposing this key to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
