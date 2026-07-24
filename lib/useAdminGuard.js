'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabaseClient';

export function useAdminGuard() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = checking, null = no session
  const initialized = useRef(false);

  useEffect(() => {
    // Initial session check — runs once
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/admin/login');
      } else {
        setSession(data.session);
        initialized.current = true;
      }
    });

    // Listen for auth events but ONLY act on actual sign-in/sign-out.
    // TOKEN_REFRESHED fires on tab focus and must NOT reload data.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' || !s) {
        router.replace('/admin/login');
        return;
      }
      // Only update session state on SIGNED_IN (first login), not on TOKEN_REFRESHED
      if (event === 'SIGNED_IN' && !initialized.current) {
        setSession(s);
        initialized.current = true;
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return session;
}
