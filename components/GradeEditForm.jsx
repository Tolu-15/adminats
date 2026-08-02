'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const FIELDS = [
  { key: 'class', label: 'Class', type: 'text', placeholder: 'e.g. A' },
  { key: 'trainer', label: 'Trainer', type: 'text', placeholder: 'Trainer name' },
  { key: 'attendance', label: 'Attendance', type: 'number', placeholder: '0' },
  { key: 'test', label: 'Test', type: 'number', placeholder: '0' },
  { key: 'assignment', label: 'Assignment', type: 'number', placeholder: '0' },
  { key: 'assessment', label: 'Assessment', type: 'number', placeholder: '0' },
  { key: 'presentation', label: 'Presentation', type: 'number', placeholder: '0' },
  { key: 'exam', label: 'Exam', type: 'number', placeholder: '0' },
  { key: 'final_grades', label: 'Final Grades', type: 'number', placeholder: '0' },
  { key: 'water_baptism', label: 'Water Baptism', type: 'select', options: ['', 'YES', 'NO'] },
  { key: 'holy_spirit_baptism', label: 'Holy Spirit Baptism', type: 'select', options: ['', 'YES', 'NO'] },
  { key: 'portal', label: 'Portal', type: 'text', placeholder: 'Portal status' },
  { key: 'status', label: 'Status', type: 'select', options: ['', 'PASSED', 'FAILED'] },
  { key: 'comments', label: 'Comments', type: 'textarea', placeholder: 'Any comments…' },
  { key: 'covenant_deed', label: 'Covenant Deed', type: 'select', options: ['', 'SIGNED', 'NOT SIGNED'] },
  { key: 'id_card_collected_date', label: 'ID Card Collected Date', type: 'date', placeholder: 'YYYY-MM-DD' },
];

export default function GradeEditForm({ studentId, initialGrades = {}, onSaved }) {
  const [form, setForm] = useState(initialGrades);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (initialGrades && Object.keys(initialGrades).length > 0) {
      setForm(initialGrades);
    }
  }, [initialGrades]);

  function handleChange(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Get the current session token to authenticate the API request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated. Please sign in again.');

      const res = await fetch(`/api/students/${studentId}/grades`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setSuccess('Grades saved successfully.');
      if (onSaved) onSaved(json.grades);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {FIELDS.map(({ key, label, type, placeholder, options }) => (
          <div className="field" key={key} style={{ marginBottom: 0 }}>
            <label>{label}</label>
            {type === 'select' ? (
              <select value={form[key] || ''} onChange={(e) => handleChange(key, e.target.value)}>
                {options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            ) : type === 'textarea' ? (
              <textarea
                placeholder={placeholder}
                value={form[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                style={{ minHeight: 60 }}
              />
            ) : (
              <input
                type={type}
                placeholder={placeholder}
                value={form[key] ?? ''}
                onChange={(e) => handleChange(key, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : '💾 Save Grades'}
      </button>
    </form>
  );
}
