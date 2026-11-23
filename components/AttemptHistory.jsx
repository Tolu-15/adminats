'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/adminFetch';
export default function AttemptHistory({ studentId }) {
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState('');
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('');
    adminFetch('/api/students/' + studentId + '/attempts').then(async res => {
      const json = await res.json(); if (!res.ok) throw new Error(json.error);
      if (!cancelled) { setAttempts(json.attempts || []); setMigrationRequired(json.migrationRequired); }
    }).catch(err => { if (!cancelled) setError(err.message || 'History unavailable.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId, refresh]);
  return <section className="card attempt-history"><div className="manual-student-heading"><h2>Programme and retake history</h2><button className="btn btn-outline btn-sm" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh history</button></div>
    <p className="muted">Current grades and preserved previous attempts. Archived attempts are read-only.</p>
    {loading && <p role="status">Loading history...</p>}{error && <div className="error-box" role="alert">{error}</div>}
    {migrationRequired && <div className="info-box">Retake history needs the database migration. Previously overwritten grades cannot be reconstructed automatically.</div>}
    {!loading && !attempts.length && !error && <p>No programme attempts recorded.</p>}
    {!loading && attempts.map(attempt => <details key={attempt.id}><summary>{attempt.stage.toUpperCase()} — {attempt.batch_name || attempt.batch_code || 'Unknown batch'} — {attempt.current ? 'Current attempt' : 'Archived attempt'} — {attempt.grades.status || 'Pending'}</summary><p className="muted">Started: {attempt.started_at ? new Date(attempt.started_at).toLocaleDateString('en-GB') : 'Not recorded'}{attempt.archived_at ? ' · Archived: ' + new Date(attempt.archived_at).toLocaleDateString('en-GB') : ''}{attempt.department ? ' · Department: ' + attempt.department : ''}</p><div className="bulk-table-scroll"><table><thead><tr><th>Field</th><th>Recorded value</th></tr></thead><tbody>{Object.entries(attempt.grades).filter(([key, value]) => !['id','student_id','registration_id','mit_registration_id','proclaimers_registration_id','created_at','updated_at'].includes(key) && value !== null && value !== '').map(([key, value]) => <tr key={key}><td>{key.replace(/_/g, ' ')}</td><td>{String(value)}</td></tr>)}</tbody></table></div></details>)}
  </section>;
}
