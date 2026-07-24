'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const MIT_FIELDS = [
  { section: 'Class Info', fields: [
    { key: 'class',    label: 'Class',    type: 'text',   placeholder: 'e.g. A' },
    { key: 'trainer',  label: 'Trainer',  type: 'text',   placeholder: 'Trainer name' },
  ]},
  { section: 'Scores', fields: [
    { key: 'midterm_test',     label: 'Midterm Test',     type: 'number' },
    { key: 'interactions',     label: 'Interactions',     type: 'number' },
    { key: 'bible_study',      label: 'Bible Study',      type: 'number' },
    { key: 'assignment',       label: 'Assignment',       type: 'number' },
    { key: 'attendance',       label: 'Attendance',       type: 'number' },
    { key: 'cth',              label: 'CTH',              type: 'number' },
    { key: 'community_service', label: 'Community Service', type: 'number' },
    { key: 'evangelism',       label: 'Evangelism',       type: 'number' },
    { key: 'presentation',     label: 'Presentation',     type: 'number' },
    { key: 'final_exam',       label: 'Final Exam',       type: 'number' },
    { key: 'final_grades',     label: 'Final Grades',     type: 'number' },
  ]},
  { section: 'Status & Notes', fields: [
    { key: 'status',    label: 'Status',   type: 'select', options: ['', 'PASSED', 'FAILED'] },
    { key: 'comments',  label: 'Comments', type: 'textarea' },
  ]},
  { section: 'Department', fields: [
    { key: 'department',              label: 'Department',              type: 'text' },
    { key: 'department_confirmation', label: 'Department Confirmation', type: 'select', options: ['', 'YES', 'NO'] },
  ]},
  { section: 'First Timer', fields: [
    { key: 'first_timer',      label: 'First Timer',             type: 'select', options: ['', 'YES', 'NO'] },
    { key: 'first_timer_date', label: 'First Timer Date of Joining', type: 'date' },
  ]},
];

export default function MitGradeEditForm({ registrationId, initialGrades = {}, session, onSaved }) {
  const [form, setForm] = useState(() => {
    const f = {};
    MIT_FIELDS.forEach(({ fields }) => fields.forEach(({ key }) => {
      f[key] = initialGrades[key] ?? '';
    }));
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveMsg(''); setSaveErr('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setSaveMsg(''); setSaveErr('');

    const { data: { session: sess } } = await supabase.auth.getSession();
    const token = sess?.access_token || session?.access_token;

    const payload = { ...form };
    // Convert numeric strings to numbers
    MIT_FIELDS.forEach(({ fields }) => fields.forEach(({ key, type }) => {
      if (type === 'number') {
        payload[key] = payload[key] !== '' && payload[key] != null ? Number(payload[key]) : null;
      }
    }));

    const res = await fetch(`/api/mit/registrations/${registrationId}/grades`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveErr(json.error || 'Save failed.'); }
    else { setSaveMsg('✓ Grades saved successfully.'); onSaved?.(); }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>MIT Grades</h3>
        <p className="muted text-sm" style={{ marginTop: 4 }}>Edit scores and fill in all relevant fields</p>
      </div>

      {MIT_FIELDS.map(({ section, fields }) => (
        <div key={section} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.8,
            color: 'var(--gold)', fontWeight: 700, marginBottom: 12,
            borderBottom: '1px solid var(--border)', paddingBottom: 6,
          }}>
            {section}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: fields.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}>
            {fields.map(({ key, label, type, options, placeholder }) => (
              <div className="field" key={key} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.78rem' }}>{label}</label>
                {type === 'select' ? (
                  <select value={form[key]} onChange={(e) => handleChange(key, e.target.value)}>
                    {options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                  </select>
                ) : type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={form[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    style={{ resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {saveMsg && <div className="success-box" style={{ marginBottom: 12 }}>{saveMsg}</div>}
      {saveErr && <div className="error-box" style={{ marginBottom: 12 }}>{saveErr}</div>}

      <button className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
        {saving ? '⏳ Saving…' : 'Save Grades'}
      </button>
    </form>
  );
}
