'use client';
import { useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '../lib/adminFetch';
import RegistrationForm from './RegistrationForm';

const initialForm = Object.fromEntries(['surname','first_name','middle_name','email','phone','date_of_birth','gender','home_address','next_of_kin','next_of_kin_relationship','next_of_kin_phone','state_of_origin','local_government','nationality','country_of_residence','education','born_again','born_again_details','baptized_water','baptized_water_details','baptized_holy_spirit','baptized_holy_spirit_details','church_join_date','challenges'].map(key => [key, '']));
export default function AddStudentForm({ batch, session, onClose, onAdded }) {
  const [mode, setMode] = useState(batch.programme_type === 'MEMBERSHIP' || !batch.programme_type ? 'new' : 'existing');
  const [form, setForm] = useState({ ...initialForm, is_first_timer: 'No' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState((batch.programme_type || 'MEMBERSHIP').toLowerCase());
  const [duplicates, setDuplicates] = useState([]);
  const [acknowledgeDuplicates, setAcknowledgeDuplicates] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' };
  async function search(e) {
    e.preventDefault(); setBusy(true); setError(''); setSelected(null);
    try {
      const res = await adminFetch('/api/students/search?q=' + encodeURIComponent(query), { headers });
      const json = await res.json(); if (!res.ok) throw new Error(json.error);
      setResults(json.students || []);
      if (!json.students?.length) setError('No students found. Try a name or student ID.');
    } catch (err) { setError(err.message || 'Search failed.'); } finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch(mode === 'new' ? '/api/register' : '/api/batches/' + batch.id + '/students', {
        method: 'POST', headers, body: JSON.stringify(mode === 'new' ? { ...form, batch_id: batch.id, acknowledgeDuplicates } : { student_id: selected?.id, stage }),
      });
      const json = await res.json(); if (!res.ok) { if (json.code === 'DUPLICATE_WARNING') { setDuplicates(json.duplicates || []); setAcknowledgeDuplicates(false); } throw new Error(json.error || 'Unable to add student.'); }
      await onAdded(); onClose();
    } catch (err) { setError(err.message || 'Unable to add student.'); } finally { setBusy(false); }
  }
  return <section className="card manual-student-form" aria-label="Add student">
    <div className="manual-student-heading"><div><h2>Add student</h2><p className="muted">Add a student to {batch.batch_name}.</p></div><button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button></div>
    <div className="manual-student-modes">
      {(!batch.programme_type || batch.programme_type === 'MEMBERSHIP') && <button className={'btn btn-sm ' + (mode === 'new' ? 'btn-primary' : 'btn-outline')} disabled={busy} onClick={() => { setMode('new'); setError(''); }}>New student</button>}
      <button className={'btn btn-sm ' + (mode === 'existing' ? 'btn-primary' : 'btn-outline')} disabled={busy} onClick={() => { setMode('existing'); setError(''); setDuplicates([]); setAcknowledgeDuplicates(false); }}>Existing student</button>
    </div>
    {mode === 'new' && duplicates.length > 0 && <div className="info-box" role="alert"><strong>Review possible duplicates</strong><p>No records have been merged or changed.</p><ul>{duplicates.map(student => <li key={student.id}>{student.deleted_at ? 'In trash: ' : ''}<Link href={student.deleted_at ? '/admin/trash' : '/admin/students/' + student.id} target="_blank" rel="noreferrer">{student.surname} {student.first_name} ({student.student_unique_id})</Link> — matching {student.reasons.join(', ')}</li>)}</ul><label className="duplicate-confirm"><input type="checkbox" checked={acknowledgeDuplicates} disabled={busy} onChange={e => setAcknowledgeDuplicates(e.target.checked)} />I reviewed these records. This is a different person; create a separate student.</label></div>}
    {mode === 'new' ? <RegistrationForm form={form} update={(key, value) => { setForm(prev => ({ ...prev, [key]: value })); setDuplicates([]); setAcknowledgeDuplicates(false); }} onSubmit={submit} submitting={busy} error={error} hidePhoto submitLabel="Add student" /> : <>
      <form onSubmit={search} className="manual-student-search"><label htmlFor="student-search">Student name or ID</label><div><input id="student-search" value={query} onChange={e => setQuery(e.target.value)} required minLength={2} /><button className="btn btn-outline" disabled={busy}>Search</button></div></form>
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="manual-student-results">{results.map(student => <button key={student.id} className={'manual-student-result' + (selected?.id === student.id ? ' selected' : '')} aria-pressed={selected?.id === student.id} disabled={busy} onClick={() => setSelected(student)}><strong>{[student.surname, student.first_name, student.middle_name].filter(Boolean).join(' ')}</strong><span className="muted">{student.student_unique_id}</span></button>)}</div>
      {selected && <form onSubmit={submit}><div className="field"><label htmlFor="student-stage">Programme</label><select id="student-stage" value={stage} onChange={e => setStage(e.target.value)}>{['membership','mit','proclaimers'].filter(value => !batch.programme_type || value === batch.programme_type.toLowerCase()).map(value => <option key={value} value={value}>{value === 'mit' ? 'MIT' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></div><p className="muted">Existing registrations are preserved. Students already enrolled in this programme cannot be added again.</p><button className="btn btn-primary" disabled={busy}>{busy ? 'Adding student...' : 'Add student'}</button></form>}
    </>}
  </section>;
}
