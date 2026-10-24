const WRITE_ROLES = ['admin', 'superadmin'];

/**
 * Resolves a Supabase user's role. Unassigned users are 'viewer' (least privilege).
 * app_metadata is only writable with the service role, so it wins over user_metadata,
 * which a signed-in user can edit themselves.
 */
export function getUserRole(user) {
  if (!user) return 'viewer';
  if (user.email === 'viewer@ats.com') return 'viewer';
  return user.app_metadata?.role || user.user_metadata?.role || 'viewer';
}

export function canWrite(user) {
  return WRITE_ROLES.includes(getUserRole(user));
}
