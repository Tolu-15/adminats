'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import StudentTable from '../../../../components/StudentTable';
import MitStudentTable from '../../../../components/MitStudentTable';
import Sidebar from '../../../../components/Sidebar';
import PageLoader from '../../../../components/PageLoader';
import QRCodeModal from '../../../../components/QRCodeModal';

export default function BatchDetail({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const id = params.id;
  const router = useRouter();

  const [session, setSession] = useState(undefined);
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [mitRegs, setMitRegs] = useState([]);
  const [proclaimersRegs, setProclaimersRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showQrModal, setShowQrModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ percent: 0, stage: '', detail: '' });
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Navigation guard when upload is in progress
  useEffect(() => {
    if (!importing) return;
    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '⚠️ Upload in progress! Leaving this page will cancel the ongoing upload.';
      return e.returnValue;
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [importing]);

  function handleNavigationGuard(e) {
    if (importing) {
      const confirmLeave = window.confirm(
        '⚠️ Upload in progress! Navigating away will cancel the ongoing file upload.\n\nAre you sure you want to cancel and leave?'
      );
      if (!confirmLeave) {
        if (e) e.preventDefault();
        return false;
      }
    }
    return true;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/admin/login');
      } else {
        const isViewer = data.session.user?.email === 'viewer@ats.com';
        setSession({ ...data.session, isViewer });
      }
    });
  }, [router]);

  async function loadAll(s) {
    const res = await fetch(`/api/batches/${id}/students`, {
      headers: { Authorization: `Bearer ${s.access_token}` },
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
    setImportProgress({
      percent: 5,
      stage: 'Step 1/4: Reading Excel migration template file…',
      detail: `File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
    });

    try {
      // Step 1: Read workbook header structure locally
      const arrayBuffer = await file.arrayBuffer();
      let sheetNames = [];
      try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        sheetNames = workbook.worksheets.map(w => w.name);
      } catch (err) {
        sheetNames = ['Worksheet'];
      }

      setImportProgress({
        percent: 20,
        stage: 'Step 2/4: Analyzing worksheets & student biodata…',
        detail: `Found ${sheetNames.length} sheet(s) [${sheetNames.slice(0, 3).join(', ')}] in ${file.name}`,
      });

      // Step 2: Live progression stages
      const interval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev.percent >= 90) {
            clearInterval(interval);
            return prev;
          }
          const nextPercent = prev.percent + Math.floor(Math.random() * 8) + 4;
          let stageMsg = 'Step 2/4: Processing student biodata & generating ATS Student IDs…';
          let detailMsg = `Validating student profiles & emails…`;

          if (nextPercent > 45 && nextPercent <= 70) {
            stageMsg = 'Step 3/4: Saving Membership & MIT grades…';
            detailMsg = `Updating attendance, test scores, and class records…`;
          } else if (nextPercent > 70 && nextPercent <= 88) {
            stageMsg = 'Step 4/4: Saving Proclaimers grades & Mountain of Influence…';
            detailMsg = `Linking Proclaimers registrations & grade payloads…`;
          } else if (nextPercent > 88) {
            stageMsg = 'Step 4/4: Finalizing batch database records & indexes…';
            detailMsg = `Completing database transactions…`;
          }

          return {
            percent: Math.min(nextPercent, 92),
            stage: stageMsg,
            detail: detailMsg,
          };
        });
      }, 350);

      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`/api/batches/${id}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });

      clearInterval(interval);

      const json = await res.json();
      if (!res.ok) {
        setImportProgress({ percent: 100, stage: 'Import Failed ❌', detail: json.error || 'Import failed.' });
        setImportResult({ error: json.error || 'Import failed.' });
      } else {
        const studentCount = json.studentsProcessed || 0;
        const gradeCount = json.gradesUpdated || 0;
        const retakeCount = json.retakesProcessed || 0;

        let detailText = `Successfully imported ${studentCount} new student profile(s) and ${gradeCount} grade record(s).`;
        if (retakeCount > 0) {
          detailText += ` Re-enrolled ${retakeCount} retake student(s).`;
        }

        setImportProgress({
          percent: 100,
          stage: 'Import Complete! 🎉',
          detail: detailText,
        });
        setImportResult(json);
      }
    } catch (err) {
      setImportProgress({ percent: 100, stage: 'Import Error ❌', detail: err.message });
      setImportResult({ error: err.message || 'Network error during import.' });
    }

    // Delay finish by 1000ms so user sees completed 100% bar
    setTimeout(async () => {
      setImporting(false);
      await loadAll(session);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1000);
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
      <Sidebar onNavigate={handleNavigationGuard} />
      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }} onClick={handleNavigationGuard}>
              ← Back
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="admin-topbar-title">{batch?.batch_name}</div>
              </div>
              <div className="muted text-sm">
                {totalCount} student{totalCount !== 1 ? 's' : ''} registered
              </div>
            </div>
          </div>
          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session?.isViewer ? (
              <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 10px', fontSize: '0.75rem' }}>
                👁️ Viewer Account (Read Only)
              </span>
            ) : (
              <span className="badge badge-gold" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                ⚡ Super Admin
              </span>
            )}
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
              {!session?.isViewer && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleUpload}
                  />
                  <button
                    className="btn btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    title="Upload filled migration template to import students"
                    style={{
                      background: importing ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.15)',
                      color: 'var(--navy)',
                      border: '1px solid rgba(212,175,55,0.5)',
                      cursor: importing ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {importing ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Importing…</>
                    ) : (
                      <><i className="fa-solid fa-file-import"></i> Import Data</>
                    )}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={downloadTemplate} title="Download master migration template Excel sheet">
                    <i className="fa-solid fa-file-excel"></i> Migration Template
                  </button>
                </>
              )}
              <button className="btn btn-outline btn-sm" onClick={downloadExcel}>
                <i className="fa-solid fa-file-export"></i> Export Grade Sheet
              </button>
              {!session?.isViewer && (
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
              )}
            </div>
          </div>

          {/* Uploading / Progressive Progress Bar Display */}
          {importing && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96))',
              border: '1px solid rgba(212, 175, 55, 0.45)',
              borderRadius: 16,
              padding: '20px 24px',
              marginBottom: 24,
              boxShadow: '0 12px 30px -5px rgba(0, 0, 0, 0.25), 0 0 20px rgba(212, 175, 55, 0.15)',
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--gold, #d4af37)', fontSize: '1.2rem',
                    boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)',
                  }}>
                    {importProgress.percent === 100 ? (
                      <i className="fa-solid fa-check" style={{ color: '#10b981' }}></i>
                    ) : (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc', letterSpacing: '-0.01em' }}>
                      {importProgress.stage || 'Uploading Batch Data…'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 2 }}>
                      {importProgress.detail}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: '1.35rem', fontWeight: 800, color: 'var(--gold, #d4af37)',
                  fontFamily: 'monospace', background: 'rgba(212,175,55,0.12)',
                  padding: '4px 14px', borderRadius: 8, border: '1px solid rgba(212,175,55,0.3)'
                }}>
                  {importProgress.percent}%
                </div>
              </div>

              {/* Glowing Progress Track */}
              <div style={{
                width: '100%', height: 10, background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 999, overflow: 'hidden', position: 'relative'
              }}>
                <div style={{
                  width: `${importProgress.percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #d4af37 0%, #f59e0b 50%, #eab308 100%)',
                  borderRadius: 999,
                  transition: 'width 0.35s ease-in-out',
                  boxShadow: '0 0 14px rgba(212, 175, 55, 0.7)',
                }} />
              </div>
            </div>
          )}

          {/* Import result & retake feedback */}
          {importResult && !importing && (
            <div style={{ marginBottom: 20 }}>
              <div
                className={importResult.error ? 'info-box' : (importResult.studentsProcessed > 0 || importResult.gradesUpdated > 0 || importResult.retakesProcessed > 0) ? 'success-box' : 'info-box'}
                style={{
                  marginBottom: importResult.retakesProcessed > 0 ? 10 : 0,
                  ...(importResult.error ? { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b' } : {}),
                }}
              >
                <strong>
                  {importResult.error
                    ? `Import Failed: ${importResult.error}`
                    : (importResult.message || `Successfully imported ${importResult.studentsProcessed || 0} student profile(s) and ${importResult.gradesUpdated || 0} grade record(s).`)}
                </strong>
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
                        <Link key={idx} href={`/admin/students/${rs.id}`} onClick={handleNavigationGuard} style={{
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
                    <StudentTable students={students} searchQuery={search} onNavigate={handleNavigationGuard} />
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
                    <MitStudentTable registrations={mitRegs} searchQuery={search} onNavigate={handleNavigationGuard} />
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
                    <ProclaimersTable registrations={proclaimersRegs} searchQuery={search} onNavigate={handleNavigationGuard} />
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
function ProclaimersTable({ registrations = [], searchQuery = '', onNavigate }) {
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
          <th>Student ID</th>
          <th>Full Name</th>
          <th>Department</th>
          <th>CIH Score</th>
          <th>Attendance</th>
          <th>Project</th>
          <th>Seminar</th>
          <th>Mountain</th>
          <th>Final Grade</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((r) => {
          const s = r.membership_student || {};
          const grade = r.proclaimers_grades?.[0] || {};
          const fullName = [s.surname, s.first_name, s.middle_name].filter(Boolean).join(' ');

          return (
            <tr key={r.id}>
              <td>
                <span className="badge badge-gold">{s.student_unique_id || '—'}</span>
              </td>
              <td>
                <Link href={`/admin/students/${s.id}`} onClick={onNavigate} style={{ fontWeight: 600, color: 'var(--navy)', textDecoration: 'none' }}>
                  {fullName || 'Unnamed Student'}
                </Link>
              </td>
              <td>{r.department || '—'}</td>
              <td>{grade.cih ?? '—'}</td>
              <td>{grade.attendance ?? '—'}</td>
              <td>{grade.project ?? '—'}</td>
              <td>{grade.seminar_attendance ?? '—'}</td>
              <td>{grade.mountain_of_influence || '—'}</td>
              <td>
                <strong>{grade.final_grades ?? '—'}</strong>
              </td>
              <td>
                <span className={`badge ${grade.status?.toLowerCase() === 'released' ? 'badge-green' : 'badge-amber'}`}>
                  {grade.status || 'Registered'}
                </span>
              </td>
              <td>
                <Link href={`/admin/students/${s.id}`} onClick={onNavigate} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
                  View Profile
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
