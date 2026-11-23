'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import StudentTable from '../../../../components/StudentTable';
import MitStudentTable from '../../../../components/MitStudentTable';
import Sidebar from '../../../../components/Sidebar';
import PageLoader from '../../../../components/PageLoader';
import BulkGradeEditor from '../../../../components/BulkGradeEditor';
import AddStudentForm from '../../../../components/AddStudentForm';
import { canWrite, getUserRole } from '../../../../lib/roles';
import Toast from '../../../../components/Toast';
import { filterAndSortStudents } from '../../../../lib/studentTableFilters';
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
  const [notice, setNotice] = useState(null);
  const [downloadBusy, setDownloadBusy] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('name-asc');
  const actionsRef = useRef(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [bulkGradesDirty, setBulkGradesDirty] = useState(false);
  const [showBulkGrades, setShowBulkGrades] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

  useEffect(() => {
    function closeActions(event) {
      if (!actionsRef.current?.contains(event.target)) actionsRef.current?.removeAttribute('open');
    }
    document.addEventListener('pointerdown', closeActions);
    return () => document.removeEventListener('pointerdown', closeActions);
  }, []);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Navigation guard when upload is in progress
  useEffect(() => {
    if (!importing) return;
    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = ' Upload in progress! Leaving this page will cancel the ongoing upload.';
      return e.returnValue;
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [importing]);

  function handleNavigationGuard(e) {
    if (importing || bulkGradesDirty) {
      const confirmLeave = window.confirm(
        bulkGradesDirty ? 'You have unsaved class grades. Leave this page and discard those edits?' : 'Import in progress. Leave this page before the result is available?'
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
        const userRole = getUserRole(data.session.user);
        const isViewer = !canWrite(data.session.user);
        setSession({ ...data.session, role: userRole, isViewer });
      }
    });
  }, [router]);

  async function loadAll(s) {
    try {
      const res = await fetch(`/api/batches/${id}/students`, { headers: { Authorization: `Bearer ${s.access_token}` } });
      const json = await res.json();
      if (!res.ok || !json.batch) throw new Error(json.error || 'Unable to load batch students.');
      setBatch(json.batch);
      setStudents(json.students || []);
      setMitRegs(json.mitRegs || []);
      setProclaimersRegs(json.proclaimersRegs || []);
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Unable to load batch students.' }); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!session) return;
    loadAll(session);

    // Re-fetch whenever the user navigates back to this page (e.g. after editing grades)
    function onFocus() { loadAll(session); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session, id]);

  async function downloadFile(kind) {
    if (downloadBusy) return;
    setDownloadBusy(kind);
    actionsRef.current?.removeAttribute('open');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(kind === 'template' ? '/api/admin/template' : `/api/batches/${id}/export`, {
        headers: { Authorization: `Bearer ${data.session?.access_token || session.access_token}` },
      });
      if (!res.ok) throw new Error(kind === 'template' ? 'Template download failed. Please try again.' : 'Export failed. Please try again.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers.get('Content-Disposition') || '';
      const rfcMatch = disp.match(/filename\*=UTF-8''([^;]+)/i);
      const stdMatch = disp.match(/filename="([^"]+)"/i);
      a.download = kind === 'template' ? 'ATS_Master_Migration_Template.xlsx' : rfcMatch ? decodeURIComponent(rfcMatch[1]) : stdMatch ? stdMatch[1] : `Batch_${batch?.batch_code}_Grades.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ type: 'success', text: kind === 'template' ? 'Template download started.' : 'Grade sheet download started.' });
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Download failed.' }); }
    finally { setDownloadBusy(''); }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || importing) return;
    actionsRef.current?.removeAttribute('open');
    if (file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) {
      setNotice({ type: 'error', text: file.size > 10 * 1024 * 1024 ? 'File exceeds the 10 MB limit. Select a smaller file.' : 'Please select an Excel (.xlsx) file. Legacy .xls files are not supported.' });
      e.target.value = '';
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`/api/batches/${id}/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || session.access_token}` }, body: fd,
      });
      const responseText = await res.text();
      let json;
      try { json = JSON.parse(responseText); } catch { throw new Error('The server returned an unreadable response. Refresh the batch and check its records before retrying.'); }
      if (!res.ok) json.error = json.error || `Import failed (HTTP ${res.status}). Check the batch records before retrying.`;
      setImportResult(json);
    } catch (error) {
      setImportResult({ error: error.message || 'Connection lost. Refresh the batch and check its records before retrying.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadAll(session);
    }
  }

  async function deleteBatch() {
    if (deleting) return;
    if (!confirm(`Are you sure you want to delete "${batch?.batch_name}"? This cannot be undone.`)) return;
    setDeleting(true);

    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`/api/batches/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${data.session?.access_token || session?.access_token}` } });
      if (!res.ok) { const json = await res.json(); throw new Error(json.error || 'Delete failed.'); }
      router.push('/admin');
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Delete failed.' }); }
    finally { setDeleting(false); }
  }

  function startRename() {
    setRenameValue(batch?.batch_name || '');
    setRenameError('');
    setRenaming(true);
  }

  function cancelRename() {
    setRenaming(false);
    setRenameValue('');
    setRenameError('');
  }

  async function saveRename() {
    const nextName = renameValue.trim();
    if (!nextName) { setRenameError('Batch name cannot be empty.'); return; }

    if (renameSaving) return;
    setRenameSaving(true);
    setRenameError('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`/api/batches/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || session?.access_token}` }, body: JSON.stringify({ batch_name: nextName }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to rename batch.');
      setBatch(prev => ({ ...prev, batch_name: json.batch.batch_name }));
      setRenaming(false); setRenameValue('');
      setNotice({ type: 'success', text: 'Batch renamed.' });
    } catch (error) { setRenameError(error.message || 'Failed to rename batch.'); }
    finally { setRenameSaving(false); }
  }

  if (session === undefined || loading) {
    return <PageLoader />;
  }

  if (!batch) return (
    <div className="admin-shell"><Sidebar /><div className="admin-main"><div className="admin-content">
      <div className="error-box" role="alert">{notice?.text || 'Batch not found or unavailable.'}</div>
      <button className="btn btn-outline" onClick={() => { setLoading(true); loadAll(session); }}>Retry</button>
      <Link className="btn btn-ghost" href="/admin">Back to batches</Link>
    </div></div></div>
  );

  const uniqueStudentIds = new Set([
    ...students.map((s) => s.id),
    ...mitRegs.map((r) => r.membership_student?.id || r.student_id),
    ...proclaimersRegs.map((r) => r.membership_student?.id || r.student_id),
  ].filter(Boolean));
  const uniqueStudentCount = uniqueStudentIds.size || students.length;
  const totalCount = uniqueStudentCount;
  const tableOptions = { status: statusFilter, sort: sortOrder };
  const visibleStudents = filterAndSortStudents(students, tableOptions);
  const visibleMit = filterAndSortStudents(mitRegs, { ...tableOptions, studentOf: row => row.membership_student, gradesOf: row => row.mit_grades });
  const visibleProclaimers = filterAndSortStudents(proclaimersRegs, { ...tableOptions, studentOf: row => row.membership_student, gradesOf: row => row.proclaimers_grades });

const tabs = [
  { id: 'ALL', label: `All (${uniqueStudentCount})` },
  { id: 'MEMBERSHIP', label: `Membership (${students.length})` },
  { id: 'MIT', label: `MIT (${mitRegs.length})` },
  { id: 'PROCLAIMERS', label: `Proclaimers (${proclaimersRegs.length})` },
];
  return (
    <div className="admin-shell">
      {notice && <Toast message={notice.text} type={notice.type} onClose={() => setNotice(null)} />}
      <Sidebar onNavigate={handleNavigationGuard} />
      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }} onClick={handleNavigationGuard}>
              Back
            </Link>
            <div style={{ minWidth: 0 }}>
              {renaming ? (
                <div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                      disabled={renameSaving}
                      style={{ fontSize: '1rem', padding: '6px 10px', minWidth: 220 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={saveRename} disabled={renameSaving} title="Save name" aria-label="Save batch name" style={{ padding: '6px 10px' }}>
                      {renameSaving ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={cancelRename} disabled={renameSaving} title="Cancel" aria-label="Cancel rename" style={{ padding: '6px 10px' }}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                  {renameError && (
                    <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: 4 }}>{renameError}</div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div
                    className="admin-topbar-title"
                    title={batch?.batch_name}
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}
                  >
                    {batch?.batch_name}
                  </div>
                  {!session?.isViewer && (
                    <button
                      onClick={startRename}
                      title="Rename batch" aria-label="Rename batch" disabled={importing || deleting || showAddStudent}
                      style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.82rem', flexShrink: 0, padding: 4 }}
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                  )}
                </div>
              )}
              <div className="muted text-sm">
                {uniqueStudentCount} student{uniqueStudentCount !== 1 ? 's' : ''} registered
              </div>
            </div>
          </div>
          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session?.isViewer ? (
              <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 10px', fontSize: '0.75rem' }}>
                 Viewer Account (Read Only)
              </span>
            ) : (
              <span className="badge badge-gold" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                 Super Admin
              </span>
            )}
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">
          {showBulkGrades && !session?.isViewer && <BulkGradeEditor batchId={id} onDirtyChange={setBulkGradesDirty} onClose={() => setShowBulkGrades(false)} onSaved={() => loadAll(session)} />}
          {showAddStudent && !session?.isViewer && <AddStudentForm batch={batch} session={session} onClose={() => setShowAddStudent(false)} onAdded={async () => { await loadAll(session); setNotice({ type: 'success', text: 'Student added to batch.' }); }} />}
          {/* Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="search-wrap" style={{ maxWidth: 320 }}>
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                aria-label="Search batch students" placeholder="Search by name or student ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="batch-actions">
              {!session?.isViewer && <button className="btn btn-primary btn-sm" onClick={() => setShowAddStudent(true)} disabled={importing || deleting || renameSaving || showAddStudent || showBulkGrades}>Add student</button>}
              {!session?.isViewer && <button className="btn btn-outline btn-sm" disabled={importing || deleting || showAddStudent || showBulkGrades} onClick={() => setShowBulkGrades(true)}>Enter class grades</button>}
              <details className="more-actions" ref={actionsRef} onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.removeAttribute('open'); e.currentTarget.querySelector('summary')?.focus(); } }}>
                <summary className="btn btn-outline btn-sm">More actions</summary>
                <div className="more-actions-list">
                  <button disabled={importing || deleting || renameSaving} onClick={() => { setShowQrModal(true); actionsRef.current?.removeAttribute('open'); }}>QR code</button>
                  {!session?.isViewer && <>
                    <button disabled={importing || deleting || renameSaving || showAddStudent || showBulkGrades} onClick={() => fileInputRef.current?.click()}>Import students and grades</button>
                    <button disabled={!!downloadBusy || importing || deleting} onClick={() => downloadFile('template')}>{downloadBusy === 'template' ? 'Downloading template...' : 'Download template'}</button>
                  </>}
                  <button disabled={!!downloadBusy || importing || deleting} onClick={() => downloadFile('export')}>{downloadBusy === 'export' ? 'Exporting grades...' : 'Export grade sheet'}</button>
                  {!session?.isViewer && <button className="danger-action" disabled={deleting || importing || renameSaving || showAddStudent || showBulkGrades} onClick={() => { actionsRef.current?.removeAttribute('open'); deleteBatch(); }}>{deleting ? 'Deleting...' : 'Delete batch'}</button>}
                </div>
              </details>
              <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleUpload} />
            </div>
          </div>
          <div className="batch-table-controls">
            <div className="field"><label htmlFor="batch-status">Status</label><select id="batch-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option><option value="PASSED">Passed</option><option value="IN_PROGRESS">In progress</option><option value="PENDING">Pending</option><option value="DROP">Drop</option>
            </select></div>
            <div className="field"><label htmlFor="batch-sort">Sort by</label><select id="batch-sort" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
              <option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="id-asc">Student ID: ascending</option><option value="id-desc">Student ID: descending</option>
            </select></div>
          </div>
          {downloadBusy && <p role="status" className="muted">{downloadBusy === 'template' ? 'Preparing template...' : 'Preparing grade sheet...'}</p>}
          {importing && <div className="info-box import-processing" role="status" aria-live="polite" aria-busy="true"><strong>Processing</strong><p>Importing students and grades. Please keep this page open until the server returns the results.</p></div>}

          {/* Import result & retake feedback */}
          {importResult && !importing && (
            <div style={{ marginBottom: 20 }}>
              <div
                role={importResult.error ? 'alert' : 'status'}
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
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
                {importResult.warnings?.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Review {importResult.warnings.length} warning(s)</summary>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
                      {importResult.warnings.slice(0, 20).map((warning, i) => <li key={i}>{warning}</li>)}
                    </ul>
                  </details>
                )}
                {importResult.dataEntryGaps?.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    <strong>Data gaps found:</strong> {importResult.dataEntryGaps.join(' ')}
                  </div>
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
                          <span style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700 }}> Retake</span>
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
                    <StudentTable emptyMessage="No students match the selected status." students={visibleStudents} searchQuery={search} onNavigate={handleNavigationGuard} />
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
                    <MitStudentTable emptyMessage="No students match the selected status." registrations={visibleMit} searchQuery={search} onNavigate={handleNavigationGuard} />
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
                    <ProclaimersTable emptyMessage="No students match the selected status." registrations={visibleProclaimers} searchQuery={search} onNavigate={handleNavigationGuard} />
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
function ProclaimersTable({ registrations = [], searchQuery = '', onNavigate, emptyMessage }) {
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
        <p className="muted">{emptyMessage || 'No Proclaimers registrations yet for this batch.'}</p>
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
