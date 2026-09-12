'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { useAdminGuard } from '../../../lib/useAdminGuard';
import Sidebar from '../../../components/Sidebar';

export default function TrashManagementPage() {
  const session = useAdminGuard();

  const [activeTab, setActiveTab] = useState('batches'); // 'batches' | 'students'
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [columnMissing, setColumnMissing] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [purgingId, setPurgingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  async function fetchTrash() {
    setLoading(true);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/trash', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBatches(data.batches || []);
        setStudents(data.students || []);
        setColumnMissing(!!data.columnMissing);
      }
    } catch (err) {
      console.error('Failed to fetch trash records:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) fetchTrash();
  }, [session]);

  async function handleRestoreBatch(id, name) {
    if (!confirm(`Restore batch "${name}" and its associated students?`)) return;

    setRestoringId(id);
    setMessage(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;

      const res = await fetch(`/api/batches/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore batch');

      setBatches((prev) => prev.filter((b) => b.id !== id));
      setMessage({ type: 'success', text: `Batch "${name}" restored successfully.` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePermanentDeleteBatch(id, name) {
    if (!confirm(`⚠️ PERMANENT DELETE: Are you sure you want to permanently delete batch "${name}" and all associated student records?\n\nThis CANNOT be undone.`)) return;

    setPurgingId(id);
    setMessage(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;

      const res = await fetch(`/api/admin/trash?type=batch&id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to permanently delete batch');

      setBatches((prev) => prev.filter((b) => b.id !== id));
      setMessage({ type: 'success', text: data.message || `Batch "${name}" permanently deleted.` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPurgingId(null);
    }
  }

  async function handleRestoreStudent(id, name) {
    if (!confirm(`Restore student "${name}"?`)) return;

    setRestoringId(id);
    setMessage(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;

      const res = await fetch(`/api/students/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore student');

      setStudents((prev) => prev.filter((s) => s.id !== id));
      setMessage({ type: 'success', text: `Student "${name}" restored successfully.` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePermanentDeleteStudent(id, name) {
    if (!confirm(`⚠️ PERMANENT DELETE: Are you sure you want to permanently delete student "${name}"?\n\nThis CANNOT be undone.`)) return;

    setPurgingId(id);
    setMessage(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;

      const res = await fetch(`/api/admin/trash?type=student&id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to permanently delete student');

      setStudents((prev) => prev.filter((s) => s.id !== id));
      setMessage({ type: 'success', text: data.message || `Student "${name}" permanently deleted.` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPurgingId(null);
    }
  }

  async function handleEmptyTrash() {
    const totalItems = batches.length + students.length;
    if (totalItems === 0) return;
    if (!confirm(`⚠️ EMPTY TRASH: Are you sure you want to permanently purge ALL ${batches.length} batch(es) and ${students.length} student(s) currently in the trash?\n\nAll records will be erased forever and CANNOT be restored.`)) return;

    setPurgingId('all');
    setMessage(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;

      const res = await fetch('/api/admin/trash?type=all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to empty trash');

      setBatches([]);
      setStudents([]);
      setMessage({ type: 'success', text: data.message || 'Trash emptied successfully.' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPurgingId(null);
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  const filteredBatches = batches.filter((b) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (b.batch_name || '').toLowerCase().includes(q) || (b.batch_code || '').toLowerCase().includes(q);
  });

  const filteredStudents = students.filter((s) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    const fullName = `${s.surname || ''} ${s.first_name || ''}`.toLowerCase();
    return fullName.includes(q) || (s.student_unique_id || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
  });

  if (session === undefined) {
    return (
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="muted">Verifying session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        {/* Topbar */}
        <div className="admin-topbar">
          <div className="admin-topbar-title">
            <i className="fa-solid fa-trash-can" style={{ marginRight: 10, color: 'var(--danger)' }}></i>
            Trash & Soft-Delete Recovery
          </div>
          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="muted text-sm">{session?.user?.email}</span>
            <button className="btn btn-outline btn-sm" onClick={fetchTrash} title="Refresh Trash">
              <i className="fa-solid fa-arrows-rotate"></i> Refresh
            </button>
            <button
              className="btn btn-sm"
              onClick={handleEmptyTrash}
              disabled={purgingId === 'all' || (batches.length === 0 && students.length === 0)}
              title="Permanently remove all items currently in trash"
              style={{
                background: (batches.length + students.length > 0) ? '#fee2e2' : '#f1f5f9',
                color: (batches.length + students.length > 0) ? '#dc2626' : '#94a3b8',
                border: `1px solid ${batches.length + students.length > 0 ? '#fca5a5' : '#cbd5e1'}`,
                fontWeight: 600,
                cursor: (batches.length + students.length > 0) ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {purgingId === 'all' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Emptying…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-fire"></i> Empty Trash ({batches.length + students.length})
                </>
              )}
            </button>
          </div>
        </div>

        <div className="admin-content">
          {/* Header Banner */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: 6 }}>Trash & Recovery</h1>
            <p className="muted text-sm">
              Items here have been soft-deleted and are hidden from the active roster. You can restore them to active status or delete them permanently forever.
            </p>
          </div>

          {/* Toast Notification */}
          {message && (
            <div style={{
              background: message.type === 'success' ? '#DEF7EC' : '#FDE8E8',
              border: `1px solid ${message.type === 'success' ? '#31C48D' : '#F98080'}`,
              color: message.type === 'success' ? '#03543F' : '#9B1C1C',
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 20,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
              <span>{message.text}</span>
            </div>
          )}

          {/* Database column missing notice */}
          {columnMissing && (
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: 8,
              padding: '14px 18px',
              marginBottom: 20,
              color: '#92400E',
              fontSize: '0.9rem',
            }}>
              <strong><i className="fa-solid fa-triangle-exclamation"></i> Notice:</strong>
              {' '}The <code>deleted_at</code> column is not yet present on your database tables.
              Run the SQL in <code>supabase/audit_log_and_soft_delete.sql</code> via Supabase SQL Editor to enable soft-deletion and recovery.
            </div>
          )}

          {/* Navigation Tabs & Search */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${activeTab === 'batches' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('batches')}
                style={{ borderRadius: 20, padding: '6px 16px' }}
              >
                Deleted Batches ({batches.length})
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'students' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('students')}
                style={{ borderRadius: 20, padding: '6px 16px' }}
              >
                Deleted Students ({students.length})
              </button>
            </div>

            {/* Filter Search */}
            <input
              type="text"
              className="input"
              placeholder={`Filter deleted ${activeTab}…`}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{ width: 240, fontSize: '0.85rem' }}
            />
          </div>

          {/* ── TAB 1: DELETED BATCHES ── */}
          {activeTab === 'batches' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Batch Name & Code</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Programme</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Students</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Deleted At</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 36, textAlign: 'center' }} className="muted">
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                          Loading trash…
                        </td>
                      </tr>
                    ) : filteredBatches.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 36, textAlign: 'center' }} className="muted">
                          No soft-deleted batches found. Trash is clear.
                        </td>
                      </tr>
                    ) : (
                      filteredBatches.map((batch) => (
                        <tr key={batch.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <strong>{batch.batch_name}</strong>
                            <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>Code: {batch.batch_code}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge" style={{ fontSize: '0.75rem' }}>{batch.programme_type || 'MEMBERSHIP'}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {batch.students?.[0]?.count || 0} students
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }} className="muted">
                            {formatTime(batch.deleted_at)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => handleRestoreBatch(batch.id, batch.batch_name)}
                                disabled={restoringId === batch.id || purgingId === batch.id}
                                style={{
                                  borderColor: '#16a34a',
                                  color: '#16a34a',
                                  fontSize: '0.8rem',
                                  padding: '4px 12px',
                                }}
                              >
                                {restoringId === batch.id ? (
                                  <>
                                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                                    Restoring…
                                  </>
                                ) : (
                                  <>
                                    <i className="fa-solid fa-trash-arrow-up" style={{ marginRight: 6 }}></i>
                                    Restore
                                  </>
                                )}
                              </button>

                              <button
                                className="btn btn-sm"
                                onClick={() => handlePermanentDeleteBatch(batch.id, batch.batch_name)}
                                disabled={purgingId === batch.id || restoringId === batch.id}
                                style={{
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  fontSize: '0.8rem',
                                  padding: '4px 12px',
                                  fontWeight: 600,
                                }}
                                title="Permanently delete batch and all its records"
                              >
                                {purgingId === batch.id ? (
                                  <>
                                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                                    Deleting…
                                  </>
                                ) : (
                                  <>
                                    <i className="fa-solid fa-trash-can" style={{ marginRight: 6 }}></i>
                                    Delete Forever
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 2: DELETED STUDENTS ── */}
          {activeTab === 'students' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Student Name & ID</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Batch</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Contact</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Deleted At</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 36, textAlign: 'center' }} className="muted">
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                          Loading trash…
                        </td>
                      </tr>
                    ) : filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 36, textAlign: 'center' }} className="muted">
                          No soft-deleted students found. Trash is clear.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const fullName = `${student.surname || ''}, ${student.first_name || ''} ${student.middle_name || ''}`.trim();
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <strong>{fullName || 'Unnamed Student'}</strong>
                              <span style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--gold)' }}>
                                {student.student_unique_id || 'No ID'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {student.batch?.batch_name || <span className="muted">No Batch</span>}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>
                              <div>{student.email || '—'}</div>
                              <div className="muted">{student.phone || '—'}</div>
                            </td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }} className="muted">
                              {formatTime(student.deleted_at)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleRestoreStudent(student.id, fullName)}
                                  disabled={restoringId === student.id || purgingId === student.id}
                                  style={{
                                    borderColor: '#16a34a',
                                    color: '#16a34a',
                                    fontSize: '0.8rem',
                                    padding: '4px 12px',
                                  }}
                                >
                                  {restoringId === student.id ? (
                                    <>
                                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                                      Restoring…
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-trash-arrow-up" style={{ marginRight: 6 }}></i>
                                      Restore
                                    </>
                                  )}
                                </button>

                                <button
                                  className="btn btn-sm"
                                  onClick={() => handlePermanentDeleteStudent(student.id, fullName)}
                                  disabled={purgingId === student.id || restoringId === student.id}
                                  style={{
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fca5a5',
                                    fontSize: '0.8rem',
                                    padding: '4px 12px',
                                    fontWeight: 600,
                                  }}
                                  title="Permanently delete student and all their data"
                                >
                                  {purgingId === student.id ? (
                                    <>
                                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                                      Deleting…
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-trash-can" style={{ marginRight: 6 }}></i>
                                      Delete Forever
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
