'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import Logo from '../../../components/Logo';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/admin');
  }

  return (
    <div className="login-shell">
      <div className="login-form-panel">
        <div className="login-form-box">
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <Logo size={180} style={{ margin: '0 auto 20px', borderRadius: '24px', display: 'block', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))' }} />
            <h1 style={{ fontSize: '1.6rem', color: 'var(--navy)', marginBottom: 6 }}>Admin Sign In</h1>
            <p className="muted text-sm">Enter your administrator credentials to continue.</p>
          </div>

          {error && (
            <div className="error-box" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="admin-email">Email address</label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-envelope" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', fontSize: '0.9rem'
                }}></i>
                <input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="admin-password">Password</label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-lock" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', fontSize: '0.9rem'
                }}></i>
                <input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            <button
              id="admin-login-btn"
              className="btn btn-primary w-full"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.95rem', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Signing in…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket"></i> Sign In
                </>
              )}
            </button>
          </form>

          <p className="muted text-sm" style={{ marginTop: 24, textAlign: 'center' }}>
            Admin accounts are created in the Supabase dashboard under Authentication → Users.
          </p>
        </div>
      </div>
    </div>
  );
}
