'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ProclaimersRegisterPage() {
  const { batchToken } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (batchToken) {
      router.replace(`/register/${batchToken}`);
    }
  }, [batchToken, router]);

  return (
    <div className="reg-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff', fontSize: '1.1rem' }}>Redirecting to registration page…</p>
    </div>
  );
}
