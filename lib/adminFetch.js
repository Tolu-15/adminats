'use client';
import { supabase } from './supabaseClient';
import { createAuthenticatedFetch } from './authenticatedFetch';

export const adminFetch = createAuthenticatedFetch({
  auth: supabase.auth,
  onSessionExpired() {
    if (typeof window === 'undefined') return;
    document.cookie = 'sb-access-token=; path=/; Max-Age=0; SameSite=Lax';
    window.location.replace('/admin/login?reason=session-expired');
  },
});
