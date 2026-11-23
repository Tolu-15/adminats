'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/adminFetch';
import { GRADE_FIELDS, validateGradeChanges } from '../lib/bulkGrades';
const label = key => key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const display = value => value === null || value === undefined || value === '' ? '(blank)' : String(value);
export default function BulkGradeEditor({ batchId, onClose, onSaved, onDirtyChange }) {
  const [stage, setStage] = useState('membership');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [className, setClassName] = useState('ALL');
  const [edits, setEdits] = useState({});
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setRows([]);
    adminFetch('/api/batches/' + batchId + '/grades?stage=' + stage).then(async res => {
      const json = await res.json(); if (!res.ok) throw new Error(json.error);
      if (!cancelled) { setRows(json.rows || []); setClassName('ALL'); setPage(1); }
    }).catch(err => { if (!cancelled) setError(err.message || 'Unable to load class.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchId, stage, reload]);
  const dirty = Object.values(edits).some(changes => Object.keys(changes).length);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const classes = [...new Set(rows.map(row => row.grades.class || '(Unassigned)'))].sort();
  const visible = rows.filter(row => className === 'ALL' || (row.grades.class || '(Unassigned)') === className).sort((a, b) => (a.student.surname + a.student.first_name).localeCompare(b.student.surname + b.student.first_name));
  const pageCount = Math.max(1, Math.ceil(visible.length / 50));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = visible.slice((currentPage - 1) * 50, currentPage * 50);
  function edit(row, key, value) {
    setReview(null); setMessage('');
    setEdits(previous => {
      const next = { ...previous, [row.registration_id]: { ...previous[row.registration_id] } };
      if (String(value ?? '') === String(row.grades[key] ?? '')) delete next[row.registration_id][key];
      else next[row.registration_id][key] = value;
      return next;
    });
  }
  function reviewChanges() {
    setError('');
    try {
      const changes = rows.filter(row => Object.keys(edits[row.registration_id] || {}).length).map(row => ({
        registration_id: row.registration_id, attempt_started_at: row.attempt_started_at, student: row.student, expected: Object.fromEntries(Object.keys(edits[row.registration_id]).map(key => [key, row.grades[key] ?? null])), changes: validateGradeChanges(stage, edits[row.registration_id]),
      }));
      if (!changes.length) throw new Error('Enter at least one grade change.');
      if (changes.length > 250) throw new Error('Save up to 250 students at a time. Filter by class first.');
      setReview(changes);
    } catch (err) { setError(err.message); }
  }
  async function save() {
    if (!review || busy) return;
    setBusy(true); setError('');
    try {
      const res = await adminFetch('/api/batches/' + batchId + '/grades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, rows: review.map(({ student, ...row }) => row) }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Save failed.');
      setEdits({}); setReview(null); setMessage('Grades saved for ' + json.saved + ' students.'); setReload(value => value + 1); await onSaved();
    } catch (err) { setReview(null); setError(err.message || 'Unable to save grades. Reload the class before retrying if the connection was lost.'); }
    finally { setBusy(false); }
  }
  return <section className="card bulk-grades" aria-label="Bulk grading">
    <div className="manual-student-heading"><div><h2>Class grade entry</h2><p className="muted">Enter scores, review every change, then save. Only edited cells will change.</p></div><button className="btn btn-outline btn-sm" disabled={busy || dirty} onClick={onClose}>Close</button></div>
    {error && <div className="error-box" role="alert">{error}</div>}{message && <div className="success-box" role="status">{message}</div>}
    <div className="batch-table-controls"><div className="field"><label htmlFor="bulk-stage">Programme</label><select id="bulk-stage" value={stage} disabled={busy || dirty || loading} onChange={e => { setStage(e.target.value); setReview(null); setMessage(''); }}><option value="membership">Membership</option><option value="mit">MIT</option><option value="proclaimers">Proclaimers</option></select></div><div className="field"><label htmlFor="bulk-class">Class</label><select id="bulk-class" value={className} disabled={busy || dirty || loading} onChange={e => { setClassName(e.target.value); setPage(1); }}><option value="ALL">All classes</option>{classes.map(name => <option key={name} value={name}>{name}</option>)}</select></div></div>
    <p className="muted text-sm">Scores must be non-negative whole numbers; final grades must be between 0 and 100. Totals and pass status are not calculated automatically. Blank edited cells clear the existing value.</p>
    {loading ? <p role="status">Loading students...</p> : review ? <>
      <h3>Review {review.length} students before saving</h3><div className="bulk-table-scroll"><table><thead><tr><th>Student</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{review.flatMap(row => Object.entries(row.changes).map(([key, value]) => <tr key={row.registration_id + key}><td>{row.student.surname} {row.student.first_name}<br />{row.student.student_unique_id}</td><td>{label(key)}</td><td>{display(row.expected[key])}</td><td>{display(value)}</td></tr>))}</tbody></table></div>
      <div className="bulk-grade-actions"><button className="btn btn-outline" disabled={busy} onClick={() => setReview(null)}>Back to editing</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Confirm and save grades'}</button></div>
    </> : <>
      {!visible.length ? <p>No registered students in this programme/class. Enrol students before entering grades.</p> : <div className="bulk-table-scroll"><table><thead><tr><th>Student</th>{GRADE_FIELDS[stage].map(key => <th key={key}>{label(key)}</th>)}<th>Status</th></tr></thead><tbody>{pagedRows.map(row => <tr key={row.registration_id}><td>{row.student.surname} {row.student.first_name}<br /><span className="muted">{row.student.student_unique_id}</span></td>{[...GRADE_FIELDS[stage], 'status'].map(key => { const value = key in (edits[row.registration_id] || {}) ? edits[row.registration_id][key] : row.grades[key] ?? ''; const name = label(key) + ' for ' + row.student.student_unique_id; return <td key={key}>{key === 'status' ? <select aria-label={name} value={value} disabled={busy} onChange={e => edit(row, key, e.target.value)}><option value="">Pending</option>{['IN_PROGRESS','PASSED','FAILED','DROP', ...(stage === 'proclaimers' ? ['RELEASED'] : [])].map(status => <option key={status}>{status}</option>)}</select> : <input type="number" min="0" max={key === 'final_grades' ? 100 : undefined} step="1" aria-label={name} value={value} disabled={busy} onChange={e => edit(row, key, e.target.value)} />}</td>; })}</tr>)}</tbody></table></div>}
      {visible.length > 50 && <div className="bulk-grade-actions"><button className="btn btn-outline btn-sm" disabled={busy || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous students</button><span>Page {currentPage} of {pageCount} · {visible.length} students</span><button className="btn btn-outline btn-sm" disabled={busy || currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next students</button></div>}
      <div className="bulk-grade-actions"><button className="btn btn-primary" disabled={busy || !dirty || loading} onClick={reviewChanges}>Review changes</button><button className="btn btn-outline" disabled={busy || loading} onClick={() => { setEdits({}); setReview(null); setReload(value => value + 1); }}>Discard edits and reload</button></div>
    </>}
  </section>;
}
