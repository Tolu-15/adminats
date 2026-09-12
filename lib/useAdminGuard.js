'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabaseClient';

export function useAdminGuard() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = checking, null = no session
  const initialized = useRef(false);

  function enrichSession(s) {
    if (!s) return null;
    const userRole = s.user?.user_metadata?.role || 'viewer';
    const isViewer = userRole === 'viewer' || s.user?.email === 'viewer@ats.com';
    return Object.assign(s, { role: userRole, isViewer });
  }

  function syncAuthCookie(token) {
    if (typeof document === 'undefined') return;
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    if (token) {
      document.cookie = `sb-access-token=${encodeURIComponent(token)}; path=/; SameSite=Lax${secure}`;
    } else {
      document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`;
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        syncAuthCookie(null);
        router.replace('/admin/login');
      } else {
        syncAuthCookie(data.session.access_token);
        setSession(enrichSession(data.session));
        initialized.current = true;
      }
    });

    // Listen for auth state changes & token refreshes
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' || !s) {
        syncAuthCookie(null);
        router.replace('/admin/login');
        return;
      }
      syncAuthCookie(s.access_token);
      setSession(enrichSession(s));
      initialized.current = true;
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return session;
}
