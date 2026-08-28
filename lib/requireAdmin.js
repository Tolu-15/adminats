import { supabaseAdmin } from './supabaseAdmin';

/**
 * Validates the Bearer token from the Authorization header.
 * Returns the authenticated Supabase user, or null if unauthorized.
 *
 * @param {Request} request - The incoming Next.js API request.
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
