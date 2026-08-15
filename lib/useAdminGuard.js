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
    const userRole = s.user?.user_metadata?.role || 'admin';
    const isViewer = userRole === 'viewer';
    return Object.assign(s, { role: userRole, isViewer });
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/admin/login');
      } else {
        setSession(enrichSession(data.session));
        initialized.current = true;
      }
    });

    // Listen for auth state changes & token refreshes
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' || !s) {
        router.replace('/admin/login');
        return;
      }
      setSession(enrichSession(s));
      initialized.current = true;
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return session;
}
