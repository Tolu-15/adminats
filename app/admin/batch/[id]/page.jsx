'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdminGuard } from '../../../../lib/useAdminGuard';
import { supabase } from '../../../../lib/supabaseClient';
import Sidebar from '../../../../components/Sidebar';
import StudentTable from '../../../../components/StudentTable';
import MitStudentTable from '../../../../components/MitStudentTable';
import PageLoader from '../../../../components/PageLoader';
import QRCodeModal from '../../../../components/QRCodeModal';

export default function BatchDetail() {
  const session = useAdminGuard();
  const { id } = useParams();
  const router = useRouter();

  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);          // Membership students
  const [mitRegs, setMitRegs] = useState([]);            // MIT registrations
  const [proclaimersRegs, setProclaimersRegs] = useState([]); // Proclaimers registrations
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');   // 'ALL' | 'MEMBERSHIP' | 'MIT' | 'PROCLAIMERS'
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const fileInputRef = useRef(null);

  async function loadAll(sessionRef) {
    const token = sessionRef?.access_token;
    const res = await fetch(`/api/batches/${id}/students?t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setBatch(json.batch);
    setStudents(json.students || []);
    setMitRegs(json.mitRegs || []);
    setProclaimersRegs(json.proclaimersRegs || []);
    setLoading(false);
  }


  useEffect(() => {
    if (!session) return;
    loadAll(session);

    // Re-fetch whenever the user navigates back to this page (e.g. after editing grades)
    function onFocus() { loadAll(session); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session, id]);

  async function downloadTemplate() {
    const res = await fetch('/api/admin/template', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { alert('Template download failed.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ATS_Master_Migration_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExcel() {
    const res = await fetch(`/api/batches/${id}/export`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { alert('Export failed.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="(.+?)"/);
    a.download = match ? match[1] : `Batch_${batch?.batch_code}_Grades.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/batches/${id}/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: fd,
    });
    const json = await res.json();
    setImportResult(json);
    setImporting(false);
    await loadAll(session);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function deleteBatch() {
    if (!confirm(`Are you sure you want to delete "${batch?.batch_name}"? This cannot be undone.`)) return;
    setDeleting(true);

    const { data: freshData } = await supabase.auth.getSession();
    const token = freshData?.session?.access_token || session?.access_token;

    const res = await fetch(`/api/batches/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      router.push('/admin');
    } else {
      const json = await res.json();
      alert(`Delete failed: ${json.error}`);
      setDeleting(false);
    }
  }

  if (session === undefined || loading) {
    return <PageLoader />;
  }

  const totalCount = students.length + mitRegs.length + proclaimersRegs.length;

  // Which tabs to show based on what exists
  const tabs = [
    { id: 'ALL', label: `All (${totalCount})` },
    ...(students.length > 0 ? [{ id: 'MEMBERSHIP', label: `Membership (${students.length})` }] : []),
    ...(mitRegs.length > 0 ? [{ id: 'MIT', label: `MIT (${mitRegs.length})` }] : []),
    ...(proclaimersRegs.length > 0 ? [{ id: 'PROCLAIMERS', label: `Proclaimers (${proclaimersRegs.length})` }] : []),
  ];

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>
              ← Back
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="admin-topbar-title">{batch?.batch_name}</div>
                <span style={{
                  background: 'rgba(212,175,55,0.12)', color: 'var(--gold)',
                  border: '1px solid rgba(212,175,55,0.3)',
                  borderRadius: 5, padding: '2px 8px',
                  fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.5,
                }}>#{batch?.batch_code}</span>
              </div>
              <div className="muted text-sm">
                {totalCount} student{totalCount !== 1 ? 's' : ''} registered
              </div>
            </div>
          </div>
          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">
          {/* Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="search-wrap" style={{ maxWidth: 320 }}>
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or student ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowQrModal(true)}>
                <i className="fa-solid fa-qrcode"></i> QR Code
              </button>
              <button className="btn btn-outline btn-sm" onClick={downloadTemplate} title="Download master migration template Excel sheet">
                <i className="fa-solid fa-file-excel"></i> Migration Template
              </button>
              <button className="btn btn-outline btn-sm" onClick={downloadExcel}>
                <i className="fa-solid fa-file-export"></i> Export Grade Sheet
              </button>
              <label className="btn btn-gold btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {importing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Migrating…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-import"></i> Batch Data Upload
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                  disabled={importing}
                />
              </label>
              <button
                className="btn btn-sm"
                onClick={deleteBatch}
                disabled={deleting}
                style={{
                  background: deleting ? '#fca5a5' : '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {deleting ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Deleting…</>
                ) : (
                  <><i className="fa-solid fa-trash"></i> Delete Batch</>
                )}
              </button>
            </div>
          </div>

          {/* Uploading / Processing Display */}
          {importing && (
            <div className="info-box" style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
              background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: 12, marginBottom: 20,
            }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}></i>
              <div>
                <strong style={{ color: 'var(--navy)', fontSize: '0.95rem' }}>Uploading Batch Data & Processing Retakes…</strong>
                <div className="muted text-sm" style={{ marginTop: 2 }}>
                  Verifying student records, resolving unique IDs, and re-enrolling retaking students from previous batches…
                </div>
              </div>
            </div>
          )}

          {/* Import result & retake feedback */}
          {importResult && !importing && (
            <div style={{ marginBottom: 20 }}>
              <div className={(importResult.studentsProcessed > 0 || importResult.gradesUpdated > 0 || importResult.retakesProcessed > 0) ? 'success-box' : 'info-box'} style={{ marginBottom: importResult.retakesProcessed > 0 ? 10 : 0 }}>
                <strong>{importResult.message || `Processed record(s).`}</strong>
                {importResult.errors?.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>

              {importResult.retakesProcessed > 0 && (
                <div style={{
                  background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)',
                  borderRadius: 10, padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--navy)', fontWeight: 700, fontSize: '0.9rem' }}>
                    <i className="fa-solid fa-rotate" style={{ color: 'var(--gold)' }}></i>
                    <span>{importResult.retakesProcessed} Retake Student(s) Re-Enrolled</span>
                  </div>
                  <p className="muted text-sm" style={{ margin: '4px 0 10px' }}>
                    These students were recognized from previous batches and automatically re-enrolled into <strong>{batch?.batch_name}</strong> for a Retake:
                  </p>
                  {importResult.retakingStudents?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {importResult.retakingStudents.map((rs, idx) => (
                        <Link key={idx} href={`/admin/students/${rs.id}`} style={{
                          background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                          padding: '5px 12px', fontSize: '0.82rem', textDecoration: 'none', color: 'var(--navy)',
                          display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                          <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>{rs.student_unique_id || 'ID'}</span>
                          <span>{rs.name}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700 }}>🔄 Retake</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Type Filter Tabs */}
          {tabs.length > 1 && (
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16,
              background: '#fff', padding: 10, borderRadius: 12, border: '1px solid var(--border)'
            }}>
              {tabs.map((tab) => {
                const isSelected = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTypeFilter(tab.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: '0.82rem',
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(212,175,55,0.12)' : 'transparent',
                      color: isSelected ? 'var(--navy)' : 'var(--muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {tab.id === 'ALL' && <i className="fa-solid fa-border-all"></i>}
                    {tab.id === 'MEMBERSHIP' && <i className="fa-solid fa-graduation-cap"></i>}
                    {tab.id === 'MIT' && <i className="fa-solid fa-book-open"></i>}
                    {tab.id === 'PROCLAIMERS' && <i className="fa-solid fa-bullhorn"></i>}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tables */}
          {totalCount === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12, color: 'var(--muted)' }}>
                <i className="fa-solid fa-users"></i>
              </div>
              <p className="muted">No students registered in this batch yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Membership Students */}
              {(typeFilter === 'ALL' || typeFilter === 'MEMBERSHIP') && students.length > 0 && (
                <div>
                  {typeFilter === 'ALL' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <i className="fa-solid fa-graduation-cap" style={{ color: '#3b82f6' }}></i>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem' }}>
                        Membership Students
                      </span>
                      <span style={{
                        background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                        border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: 20, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 600,
                      }}>{students.length}</span>
                    </div>
                  )}
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <StudentTable students={students} searchQuery={search} />
                  </div>
                </div>
              )}

              {/* MIT Students */}
              {(typeFilter === 'ALL' || typeFilter === 'MIT') && mitRegs.length > 0 && (
                <div>
                  {typeFilter === 'ALL' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <i className="fa-solid fa-book-open" style={{ color: '#d4af37' }}></i>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem' }}>
                        MIT Students
                      </span>
                      <span style={{
                        background: 'rgba(212,175,55,0.12)', color: '#d4af37',
                        border: '1px solid rgba(212,175,55,0.3)',
                        borderRadius: 20, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 600,
                      }}>{mitRegs.length}</span>
                    </div>
                  )}
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <MitStudentTable registrations={mitRegs} searchQuery={search} />
                  </div>
                </div>
              )}

              {/* Proclaimers Students */}
              {(typeFilter === 'ALL' || typeFilter === 'PROCLAIMERS') && proclaimersRegs.length > 0 && (
                <div>
                  {typeFilter === 'ALL' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <i className="fa-solid fa-bullhorn" style={{ color: '#8b5cf6' }}></i>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem' }}>
                        Proclaimers Students
                      </span>
                      <span style={{
                        background: 'rgba(139,92,246,0.12)', color: '#8b5cf6',
                        border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: 20, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 600,
                      }}>{proclaimersRegs.length}</span>
                    </div>
                  )}
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <ProclaimersTable registrations={proclaimersRegs} searchQuery={search} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QR Code Modal */}
          {showQrModal && (
            <QRCodeModal
              batch={batch}
              onClose={() => setShowQrModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Inline Proclaimers table matching StudentTable & MitStudentTable design
function ProclaimersTable({ registrations = [], searchQuery = '' }) {
  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? registrations.filter((r) => {
        const s = r.membership_student || {};
        const fullName = `${s.first_name || ''} ${s.middle_name || ''} ${s.surname || ''}`.toLowerCase();
        return (
          fullName.includes(q) ||
          s.student_unique_id?.toLowerCase().includes(q) ||
          s.card_number?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q)
        );
      })
    : registrations;

  if (registrations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p className="muted">No Proclaimers registrations yet for this batch.</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p className="muted">No Proclaimers students match "<strong>{searchQuery}</strong>".</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Photo</th>
          <th>Student ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Department</th>
          <th>Status</th>
          <th>Registered</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((reg) => {
          const s = reg.membership_student || {};
          const g = reg.proclaimers_grades?.[0] || {};
          const status = (g.status || '').toString().trim().toUpperCase();

          return (
            <tr key={reg.id}>
              <td>
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                  }}>
                    {s.first_name?.[0]}{s.surname?.[0]}
                  </div>
                )}
              </td>
              <td><span className="badge badge-gold">{s.student_unique_id}</span></td>
              <td>
                <Link href={`/admin/students/${s.id}`} style={{ fontWeight: 600, color: 'var(--navy)' }}>
                  {s.surname} {s.first_name}
                </Link>
              </td>
              <td className="muted text-sm">{s.email || '—'}</td>
              <td className="muted text-sm">{g.department || reg.department || <span style={{ opacity: 0.4 }}>—</span>}</td>
              <td>
                {status === 'PASSED' ? (
                  <span className="grade-pill passed">PASSED</span>
                ) : status === 'FAILED' ? (
                  <span className="grade-pill failed">FAILED</span>
                ) : (
                  <span className="grade-pill pending">Pending</span>
                )}
              </td>
              <td className="muted text-sm">{new Date(reg.created_at).toLocaleDateString()}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Link href={`/admin/students/${s.id}?tab=PROCLAIMERS`} className="btn btn-primary btn-sm">
                    Edit Grades
                  </Link>
                  <Link href={`/admin/students/${s.id}`} className="btn btn-outline btn-sm">
                    Profile
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
