'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { useAdminGuard } from '../../../lib/useAdminGuard';
import Sidebar from '../../../components/Sidebar';

const ACTION_CONFIG = {
  STUDENT_UPDATE:  { label: 'Profile Update', color: '#2563eb', bg: 'rgba(37,99,235,0.1)', icon: 'fa-pen-to-square' },
  GRADE_UPDATE:    { label: 'Grade Edit',     color: '#d97706', bg: 'rgba(217,119,6,0.1)',  icon: 'fa-award' },
  BATCH_CREATE:    { label: 'Batch Created',  color: '#059669', bg: 'rgba(5,150,105,0.1)',  icon: 'fa-plus' },
  BATCH_IMPORT:    { label: 'Batch Imported', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: 'fa-file-excel' },
  STUDENT_DELETE:  { label: 'Student Trashed',color: '#dc2626', bg: 'rgba(220,38,38,0.1)', icon: 'fa-trash-can' },
  BATCH_DELETE:    { label: 'Batch Trashed',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)', icon: 'fa-trash-can' },
  BATCH_RESTORE:   { label: 'Batch Restored', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  icon: 'fa-rotate-left' },
  STUDENT_RESTORE: { label: 'Student Restored',color: '#16a34a', bg: 'rgba(22,163,74,0.1)', icon: 'fa-rotate-left' },
};

export default function AuditLogsPage() {
  const session = useAdminGuard();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [tableMissing, setTableMissing] = useState(false);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLog, setActiveLog] = useState(null); // For detail modal
  const [showRawJson, setShowRawJson] = useState(false);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;
      if (!token) return;

      const params = new URLSearchParams();
      if (actionFilter !== 'ALL') params.set('action', actionFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '50');

      const res = await fetch(`/api/admin/audit?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTableMissing(!!data.tableMissing);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      fetchLogs();
    }
  }, [session, actionFilter]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchLogs();
  }

  function formatTime(isoString) {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
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
            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 10, color: 'var(--gold)' }}></i>
            Security & Mutation Audit Logs
          </div>
          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
            <button className="btn btn-outline btn-sm" onClick={fetchLogs} title="Refresh Logs">
              <i className="fa-solid fa-arrows-rotate"></i> Refresh
            </button>
          </div>
        </div>

        <div className="admin-content">
          {/* Header Banner */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: 6 }}>Audit Trail</h1>
            <p className="muted text-sm">
              Live activity log showing what was changed, which student or batch was affected, and who made the change.
            </p>
          </div>

          {/* Table missing alert */}
          {tableMissing && (
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: 8,
              padding: '14px 18px',
              marginBottom: 20,
              color: '#92400E',
              fontSize: '0.9rem',
            }}>
              <strong><i className="fa-solid fa-triangle-exclamation"></i> Action Required:</strong>
              {' '}The <code>audit_logs</code> table has not been created in Supabase yet.
              Run the SQL in <code>supabase/audit_log_and_soft_delete.sql</code> via your Supabase SQL Editor to begin capturing persistent logs.
            </div>
          )}

          {/* Filter & Search Controls */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Actions' },
                { id: 'GRADE_UPDATE', label: 'Grades' },
                { id: 'STUDENT_UPDATE', label: 'Profile Updates' },
                { id: 'BATCH_IMPORT', label: 'Excel Imports' },
                { id: 'BATCH_CREATE', label: 'Batch Creation' },
                { id: 'STUDENT_DELETE', label: 'Student Deletions' },
                { id: 'BATCH_DELETE', label: 'Batch Deletions' },
                { id: 'BATCH_RESTORE', label: 'Restorations' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActionFilter(filter.id)}
                  className={`btn btn-sm ${actionFilter === filter.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ borderRadius: 20, fontSize: '0.8rem', padding: '4px 12px' }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="input"
                placeholder="Search actor or student name/ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 280, fontSize: '0.85rem' }}
              />
              <button type="submit" className="btn btn-outline btn-sm">
                <i className="fa-solid fa-magnifying-glass"></i>
              </button>
            </form>
          </div>

          {/* Audit Logs Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)', width: 140 }}>Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Activity & Summary</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Target (Student / Batch)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)' }}>Performed By</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy)', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 36, textAlign: 'center' }} className="muted">
                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                        Loading audit trail…
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 36, textAlign: 'center' }} className="muted">
                        No audit log entries found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: 'var(--navy)', bg: 'var(--paper)', icon: 'fa-circle-info' };
                      const details = log.details || {};
                      const targetName = (details.entity_name && details.entity_name !== 'Student' && details.entity_name !== 'Batch')
                        ? details.entity_name
                        : (log.entity_name && log.entity_name !== 'Student' && log.entity_name !== 'Batch')
                          ? log.entity_name
                          : details.student_unique_id
                            ? `Student (${details.student_unique_id})`
                            : log.entity_type === 'student'
                              ? `Student #${log.entity_id?.slice(0, 8)}`
                              : log.entity_type === 'batch'
                                ? `Batch #${log.entity_id?.slice(0, 8)}`
                                : (log.entity_id || 'Record');
                      const studentId = details.student_unique_id;
                      const isStudentLink = (log.entity_type === 'student' && log.entity_id) || (log.entity_type === 'grades' && (details.student_id || log.entity_id));
                      const studentProfileId = log.entity_type === 'student' ? log.entity_id : (details.student_id || log.entity_id);

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '0.82rem' }} className="muted">
                            {formatTime(log.created_at)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: cfg.color,
                                background: cfg.bg,
                              }}>
                                <i className={`fa-solid ${cfg.icon}`}></i> {cfg.label}
                              </span>
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>
                              {log.summary || 'Administrative mutation'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--navy)' }}>
                              {isStudentLink ? (
                                <Link
                                  href={details.programme === 'mit' && details.registration_id ? `/admin/mit-student/${details.registration_id}` : `/admin/students/${studentProfileId}`}
                                  style={{ color: 'var(--navy)', textDecoration: 'underline' }}
                                  title={details.programme === 'mit' ? 'Open MIT Student Record' : 'Open Student Profile'}
                                >
                                  {targetName}
                                </Link>
                              ) : log.entity_type === 'batch' && log.entity_id ? (
                                <Link
                                  href={`/admin/batch/${log.entity_id}`}
                                  style={{ color: 'var(--navy)', textDecoration: 'underline' }}
                                  title="Open Batch View"
                                >
                                  {targetName}
                                </Link>
                              ) : (
                                targetName
                              )}
                              {details.programme && (
                                <span className="badge" style={{ fontSize: '0.68rem', marginLeft: 6, textTransform: 'uppercase' }}>
                                  {details.programme}
                                </span>
                              )}
                            </div>
                            {studentId && (
                              <span className="badge badge-gold" style={{ fontSize: '0.72rem', marginTop: 3, display: 'inline-block' }}>
                                {studentId}
                              </span>
                            )}
                            {details.batch_code && (
                              <span className="muted text-sm" style={{ display: 'block', fontSize: '0.75rem' }}>
                                Code: {details.batch_code}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.84rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <i className="fa-solid fa-user-shield" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}></i>
                              <span>{log.actor_email || 'System'}</span>
                            </div>
                            {log.ip_address && (
                              <span className="muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace', display: 'block', marginTop: 2 }}>
                                {log.ip_address}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => { setActiveLog(log); setShowRawJson(false); }}
                              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                            >
                              <i className="fa-solid fa-eye" style={{ marginRight: 4 }}></i> Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Summary */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem',
            }} className="muted">
              <span>Showing {logs.length} of {total} events</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inspect Details Modal */}
      {activeLog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 620, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: (ACTION_CONFIG[activeLog.action] || {}).bg || 'var(--paper)',
                  color: (ACTION_CONFIG[activeLog.action] || {}).color || 'var(--navy)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                }}>
                  <i className={`fa-solid ${(ACTION_CONFIG[activeLog.action] || {}).icon || 'fa-info'}`}></i>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0 }}>
                    {(ACTION_CONFIG[activeLog.action] || {}).label || activeLog.action}
                  </h2>
                  <span className="muted text-sm">{formatTime(activeLog.created_at)}</span>
                </div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setActiveLog(null)}
                style={{ borderRadius: '50%', width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Summary Box */}
            <div style={{
              background: 'var(--paper)',
              borderRadius: 8,
              padding: '12px 16px',
              border: '1px solid var(--line)',
              marginBottom: 16,
              fontSize: '0.9rem',
            }}>
              <strong>Summary:</strong> {activeLog.summary || 'Administrative modification'}
            </div>

            {/* Key Value Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '0.85rem' }}>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>Target Entity</span>
                <strong>
                  {(activeLog.details?.entity_name && activeLog.details?.entity_name !== 'Student')
                    ? activeLog.details.entity_name
                    : (activeLog.entity_name && activeLog.entity_name !== 'Student')
                      ? activeLog.entity_name
                      : activeLog.details?.student_unique_id
                        ? `Student (${activeLog.details.student_unique_id})`
                        : activeLog.entity_id}
                </strong>
                {activeLog.details?.student_unique_id && (
                  <span className="badge badge-gold" style={{ fontSize: '0.72rem', marginLeft: 6 }}>
                    {activeLog.details.student_unique_id}
                  </span>
                )}
                {activeLog.details?.programme && (
                  <span className="badge" style={{ fontSize: '0.72rem', marginLeft: 6, textTransform: 'uppercase' }}>
                    {activeLog.details.programme}
                  </span>
                )}
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>Action Type</span>
                <span style={{ fontWeight: 600 }}>{activeLog.action}</span>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>Performed By</span>
                <span>{activeLog.actor_email || 'System'}</span>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>IP Address</span>
                <span style={{ fontFamily: 'monospace' }}>{activeLog.ip_address || 'None'}</span>
              </div>
            </div>

            {/* Changed Fields / Metadata Breakdown */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
              {/* Import statistics for BATCH_IMPORT */}
              {activeLog.details?.students_processed !== undefined && (
                <div style={{ marginBottom: 14, padding: 12, background: 'rgba(139,92,246,0.08)', borderRadius: 6, border: '1px solid rgba(139,92,246,0.2)' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#6d28d9' }}>Excel Import Statistics:</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    Students Processed: <strong>{activeLog.details.students_processed}</strong> · Grades Updated: <strong>{activeLog.details.grades_updated || 0}</strong>
                    {activeLog.details.retakes_processed ? ` · Retakes Processed: ${activeLog.details.retakes_processed}` : ''}
                  </div>
                </div>
              )}

              {/* If we have detailed before/after changes */}
              {activeLog.details?.changes && Object.keys(activeLog.details.changes).length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 8, color: 'var(--navy)' }}>
                    Modified Field Changes:
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(activeLog.details.changes).map(([field, diff]) => (
                      <div
                        key={field}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--paper)',
                          padding: '7px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          fontSize: '0.82rem',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--navy)', textTransform: 'capitalize' }}>
                          {field.replace(/_/g, ' ')}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#dc2626', textDecoration: 'line-through', background: 'rgba(220,38,38,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                            {diff?.from !== null && diff?.from !== undefined && diff?.from !== '' ? String(diff.from) : '(empty)'}
                          </span>
                          <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}></i>
                          <span style={{ color: '#16a34a', fontWeight: 600, background: 'rgba(22,163,74,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                            {diff?.to !== null && diff?.to !== undefined && diff?.to !== '' ? String(diff.to) : '(cleared)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (activeLog.action === 'STUDENT_UPDATE' || activeLog.action === 'GRADE_UPDATE') && (activeLog.details?.actually_modified_fields?.length === 0 || (activeLog.details?.student_fields && activeLog.details.student_fields.length === 0)) ? (
                <div style={{ marginBottom: 14, padding: 12, background: 'rgba(22,163,74,0.08)', borderRadius: 6, border: '1px solid rgba(22,163,74,0.2)', fontSize: '0.84rem' }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', marginRight: 6 }}></i>
                  No values were modified. Record was saved with identical data.
                </div>
              ) : activeLog.details?.student_fields?.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>Modified Fields:</strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {activeLog.details.student_fields.map((f) => (
                      <span key={f} className="badge" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeLog.details?.final_grades != null && (
                <div style={{ marginBottom: 12, padding: 10, background: 'rgba(217,119,6,0.08)', borderRadius: 6, border: '1px solid rgba(217,119,6,0.2)' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#92400e' }}>Grade Overview:</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    Final Grade: <strong>{activeLog.details.final_grades}</strong> · Status: <strong>{activeLog.details.status || 'Pending'}</strong>
                  </div>
                </div>
              )}

              {/* Toggle Raw JSON */}
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.78rem', padding: '4px 0', color: 'var(--muted)' }}
                >
                  <i className={`fa-solid ${showRawJson ? 'fa-chevron-down' : 'fa-chevron-right'}`} style={{ marginRight: 6 }}></i>
                  {showRawJson ? 'Hide' : 'View'} Raw Payload
                </button>

                {showRawJson && (
                  <pre style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    marginTop: 6,
                  }}>
                    {JSON.stringify(activeLog.details || {}, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setActiveLog(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
