'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

const SCORE_FIELDS = [
  { key: 'midterm_test',      label: 'Midterm Test' },
  { key: 'interactions',      label: 'Interactions' },
  { key: 'bible_study',       label: 'Bible Study' },
  { key: 'assignment',        label: 'Assignment' },
  { key: 'attendance',        label: 'Attendance' },
  { key: 'cth',               label: 'CTH' },
  { key: 'community_service', label: 'Community Service' },
  { key: 'evangelism',        label: 'Evangelism' },
  { key: 'presentation',      label: 'Presentation' },
  { key: 'final_exam',        label: 'Final Exam' },
  { key: 'final_grades',      label: 'Final Grades' },
];

const EXTRA_FIELDS = [
  { key: 'class',                   label: 'Class',                   type: 'text' },
  { key: 'trainer',                 label: 'Trainer',                 type: 'text' },
  { key: 'status',                  label: 'Status',                  type: 'select', options: ['', 'IN_PROGRESS', 'PASSED', 'FAILED', 'DROP'] },
  { key: 'department',              label: 'Department',              type: 'text' },
  { key: 'department_confirmation', label: 'Dept Confirmation',       type: 'select', options: ['', 'YES', 'NO'] },
  { key: 'first_timer',             label: 'First Timer',             type: 'select', options: ['', 'YES', 'NO'] },
  { key: 'first_timer_date',        label: 'First Timer Date',        type: 'date' },
  { key: 'comments',                label: 'Comments',                type: 'textarea' },
];

const NUM_KEYS = new Set(SCORE_FIELDS.map((f) => f.key));

export default function MitGradeEditForm({ registrationId, initialGrades = {}, session, onSaved }) {
  const router = useRouter();

  const [grades, setGrades] = useState(initialGrades);
  const [form, setForm] = useState(initialGrades);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // { type, text }

  // Sync when initialGrades prop updates
  useEffect(() => {
    setGrades(initialGrades);
    setForm(initialGrades);
  }, [initialGrades]);

  function startEditing() {
    setForm({ ...grades });
    setSaveMsg(null);
    setEditing(true);
  }

  function cancelEditing() {
    setForm({ ...grades });
    setEditing(false);
    setSaveMsg(null);
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);

    const { data: { session: sess } } = await supabase.auth.getSession();
    const token = sess?.access_token || session?.access_token;

    // Build payload — convert numeric strings to numbers
    const payload = { ...form };
    for (const key of NUM_KEYS) {
      payload[key] = payload[key] !== '' && payload[key] != null ? Number(payload[key]) : null;
    }

    try {
      const res = await fetch(`/api/mit/registrations/${registrationId}/grades`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');

      // Update local state with returned grade — no full reload needed
      const saved = json.grades || payload;
      setGrades(saved);
      setForm(saved);
      setEditing(false);
      setSaveMsg({ type: 'success', text: 'Grades saved.' });
      setTimeout(() => setSaveMsg(null), 3000);
      router.refresh(); // invalidate cached batch page
      onSaved?.();
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const status = (grades?.status || '').toString().trim().toUpperCase();

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--navy)' }}>MIT Class Grades</h2>
          <p className="muted text-sm" style={{ marginTop: 2 }}>Edit scores and additional details</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveMsg && (
            <span style={{ fontSize: '0.8rem', color: saveMsg.type === 'success' ? '#16a34a' : '#dc2626' }}>
              {saveMsg.text}
            </span>
          )}
          {!(session?.isViewer || session?.user?.user_metadata?.role === 'viewer') && (
            editing ? (
              <>
                <button className="btn btn-outline btn-sm" onClick={cancelEditing}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : '💾 Save'}
                </button>
              </>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={startEditing}>✏️ Edit MIT Grades</button>
            )
          )}
        </div>
      </div>

      {/* Score grid */}
      <div className="grades-grid" style={{ marginBottom: 20 }}>
        {SCORE_FIELDS.map(({ key, label }) => (
          <div className="grade-box" key={key}>
            <div className="grade-box-label">{label}</div>
            {editing ? (
              <input
                type="number"
                value={form[key] ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setForm((p) => {
                    const next = { ...p, [key]: val };
                    // Auto-set IN_PROGRESS when a score is entered and status is blank
                    if (val !== '' && val !== null && !next.status) {
                      next.status = 'IN_PROGRESS';
                    }
                    return next;
                  });
                }}
                style={{
                  width: '100%', padding: '4px 6px', fontSize: '1rem',
                  fontWeight: 700, textAlign: 'center',
                  border: '1.5px solid var(--gold)', borderRadius: 6,
                  background: 'var(--paper)',
                }}
              />
            ) : (
              <div className={`grade-box-value ${grades[key] == null ? 'empty' : ''}`}>
                {grades[key] ?? '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Extra fields */}
      <div className="section-title">Additional Details</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {EXTRA_FIELDS.map(({ key, label, type, options }) => (
          <div key={key}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 4 }}>
              {label}
            </div>
            {editing ? (
              type === 'select' ? (
                <select
                  value={form[key] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
                >
                  {options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                </select>
              ) : type === 'textarea' ? (
                <textarea
                  value={form[key] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.85rem', minHeight: 60, resize: 'vertical' }}
                />
              ) : (
                <input
                  type={type}
                  value={form[key] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
                />
              )
            ) : (
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--navy)' }}>
                {key === 'status' ? (
                  status === 'PASSED' ? <span className="grade-pill passed">PASSED</span>
                    : status === 'FAILED' || status === 'DROP' ? <span className="grade-pill failed">DROP</span>
                    : status === 'IN_PROGRESS' ? <span className="grade-pill in-progress">IN PROGRESS</span>
                    : <span className="grade-pill pending">Pending</span>
                ) : (
                  grades[key] || <span className="muted">—</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
