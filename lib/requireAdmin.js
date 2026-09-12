import { supabaseAdmin } from './supabaseAdmin';

/**
 * Validates the Bearer token from the Authorization header, cookie, or query parameter.
 * Returns the authenticated Supabase user, or null if unauthorized.
 *
 * @param {Request} request - The incoming Next.js API request.
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function requireAdmin(request) {
  let token = null;

  // 1. Check Authorization header: Bearer <token>
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Check Cookie (sb-access-token)
  if (!token) {
    if (request.cookies && typeof request.cookies.get === 'function') {
      token = request.cookies.get('sb-access-token')?.value || null;
    }
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  // 3. Check query parameter: ?token= or ?auth=
  if (!token && request.url) {
    try {
      const url = new URL(request.url);
      token = url.searchParams.get('token') || url.searchParams.get('auth');
    } catch {
      // Ignore URL parse error
    }
  }

  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
