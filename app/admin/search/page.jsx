'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { useAdminGuard } from '../../../lib/useAdminGuard';
import Sidebar from '../../../components/Sidebar';
import { getImageUrl } from '../../../lib/getImageUrl';

export default function SearchStudents() {
  const session = useAdminGuard();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    if (!query.trim()) { setResults([]); setSearched(false); return; }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      const q = query.trim();
      const { data } = await supabase
        .from('students')
        .select('id, student_unique_id, surname, first_name, middle_name, photo_url, created_at, batches(batch_name, batch_code)')
        .or(`surname.ilike.%${q}%,first_name.ilike.%${q}%,student_unique_id.ilike.%${q}%,email.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(40);
      setResults(data || []);
      setLoading(false);
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query, session]);

  if (session === undefined) {
    return (
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="muted">Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-title">Search Students</div>
          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Search hero */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
              <h1 style={{ fontSize: '1.5rem', marginBottom: 8, color: 'var(--navy)' }}>Find a Student</h1>
              <p className="muted text-sm">Search by name, student ID, or email across all batches</p>
            </div>

            <div className="search-wrap" style={{ maxWidth: '100%', marginBottom: 24 }}>
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, student ID, or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                style={{ fontSize: '1rem', padding: '13px 13px 13px 42px' }}
              />
            </div>

            {/* Results */}
            {loading && (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <p className="muted">Searching…</p>
              </div>
            )}

            {!loading && searched && results.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>🫤</div>
                <p className="muted">No students found matching "<strong>{query}</strong>"</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: '#FAFAF9' }}>
                  <span className="muted text-sm">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>Batch</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {s.photo_url
                              ? <img src={getImageUrl(s.photo_url)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                              : (
                                <div style={{
                                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                  background: 'linear-gradient(135deg, #E4C875, #B8862E)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#fff', fontWeight: 700, fontSize: '0.72rem',
                                }}>
                                  {s.first_name?.[0]}{s.surname?.[0]}
                                </div>
                              )}
                            <Link href={`/admin/students/${s.id}`} style={{ fontWeight: 600, color: 'var(--navy)' }}>
                              {s.surname} {s.first_name} {s.middle_name || ''}
                            </Link>
                          </div>
                        </td>
                        <td><span className="badge badge-gold">{s.student_unique_id}</span></td>
                        <td>
                          <span className="badge">{s.batches?.batch_name || '—'}</span>
                        </td>
                        <td className="muted text-sm">{new Date(s.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!searched && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-light)' }}>
                <p className="text-sm">Start typing to search across all registered students</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
