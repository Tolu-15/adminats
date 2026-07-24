'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Logo from '../../../components/Logo';

export default function ProclaimersRegisterPage() {
  const { batchToken } = useParams();
  const [batch, setBatch] = useState(null);
  const [batchError, setBatchError] = useState('');

  // Step state
  const [step, setStep] = useState(1); // 1 = lookup, 2 = confirm, 3 = success
  const [query, setQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundStudent, setFoundStudent] = useState(null);

  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load batch from token
  useEffect(() => {
    async function loadBatch() {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_name, batch_code, programme_type, is_active')
        .eq('reg_token', batchToken)
        .single();

      if (error || !data) { setBatchError('This registration link is invalid or has expired.'); return; }
      if (!data.is_active) { setBatchError('This registration batch is no longer active.'); return; }
      if (data.programme_type !== 'PROCLAIMERS') { setBatchError('This link is not for a Proclaimers registration.'); return; }
      setBatch(data);
    }
    if (batchToken) loadBatch();
  }, [batchToken]);

  async function handleLookup(e) {
    e.preventDefault();
    setLookupError('');
    setFoundStudent(null);
    if (!query.trim()) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/proclaimers/lookup?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setLookupError(json.error || 'Student not eligible or not found.');
      } else {
        setFoundStudent(json.student);
        setStep(2);
      }
    } catch {
      setLookupError('Network error. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setSubmitError('');
    if (!department.trim()) {
      setSubmitError('Department is compulsory for Proclaimers registration. Please enter your department.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/proclaimers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.id,
          membership_student_id: foundStudent.id,
          department: department.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSubmitError(json.error || 'Registration failed.'); }
      else { setSuccessMsg(json.message); setStep(3); }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / Error state ──
  if (batchError) return (
    <div className="reg-bg">
      <div className="reg-card" style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16, color: 'var(--gold)' }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2 style={{ color: 'var(--gold)', marginBottom: 8 }}>Link Unavailable</h2>
        <p className="muted">{batchError}</p>
      </div>
    </div>
  );

  if (!batch) return (
    <div className="reg-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="reg-bg">
      <div className="reg-card" style={{ maxWidth: 560 }}>
        {/* Header with big logo */}
        <div className="reg-header" style={{ marginBottom: 28 }}>
          <Logo size={160} style={{ marginBottom: 20, borderRadius: '24px', display: 'block', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))' }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(139,92,246,0.15)', borderRadius: 20,
            padding: '6px 16px', marginBottom: 14, border: '1px solid rgba(139,92,246,0.3)'
          }}>
            <i className="fa-solid fa-bullhorn" style={{ color: '#8b5cf6', fontSize: '0.85rem' }}></i>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8b5cf6', letterSpacing: 1 }}>PROCLAIMERS</span>
          </div>
          <h1 style={{ fontSize: '1.7rem', color: 'var(--navy)', margin: '0 0 6px' }}>{batch.batch_name}</h1>
          <p className="muted text-sm">Proclaimers Registration — Batch #{batch.batch_code}</p>
        </div>

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {['Verify Identity', 'Department', 'Done'].map((label, i) => {
            const isActive = step === i + 1;
            const isDone = step > i + 1;
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 4, borderRadius: 2, marginBottom: 6,
                  background: isDone || isActive ? '#8b5cf6' : 'var(--line)',
                  transition: 'background 0.3s',
                }} />
                <span style={{
                  fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#8b5cf6' : 'var(--muted)'
                }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Lookup ── */}
        {step === 1 && (
          <form onSubmit={handleLookup}>
            <div className="field">
              <label style={{ fontWeight: 600, color: 'var(--navy)' }}>Student ID or Card Number *</label>
              <p className="muted text-sm" style={{ marginBottom: 10 }}>
                Enter your Membership student ID (e.g. ATS-055-0001) or your physical membership card number.
              </p>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-id-card" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', fontSize: '0.95rem'
                }}></i>
                <input
                  type="text"
                  placeholder="e.g. ATS-055-0001 or card number"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  style={{ paddingLeft: 40, fontSize: '1rem', letterSpacing: 0.5 }}
                />
              </div>
            </div>

            {lookupError && (
              <div className="error-box" style={{ marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginTop: 2, flexShrink: 0 }}></i>
                <div>{lookupError}</div>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }} disabled={lookupLoading}>
              {lookupLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Searching…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-magnifying-glass"></i> Search Eligibility
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 2: Confirm identity + Compulsory Department ── */}
        {step === 2 && foundStudent && (
          <form onSubmit={handleRegister}>
            {/* Student identity card */}
            <div style={{
              background: '#fff', border: '1.5px solid #8b5cf6',
              borderRadius: 12, padding: 20, marginBottom: 20,
              display: 'flex', gap: 16, alignItems: 'flex-start',
              boxShadow: '0 4px 12px rgba(139,92,246,0.1)'
            }}>
              {foundStudent.photo_url ? (
                <img src={foundStudent.photo_url} alt="Photo"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #8b5cf6' }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: '#fff'
                }}>
                  {foundStudent.first_name?.[0]}{foundStudent.surname?.[0]}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy)' }}>{foundStudent.full_name}</div>
                <div className="muted text-sm" style={{ marginTop: 2 }}>{foundStudent.student_unique_id}</div>
                {foundStudent.card_number && (
                  <div className="muted text-sm">Card: {foundStudent.card_number}</div>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(34,197,94,0.15)', color: '#16a34a',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>
                    <i className="fa-solid fa-circle-check"></i> MEMBERSHIP PASSED
                  </span>
                  <span style={{
                    background: 'rgba(212,175,55,0.15)', color: 'var(--gold)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>
                    <i className="fa-solid fa-graduation-cap"></i> MIT PASSED
                  </span>
                </div>
              </div>
            </div>

            {/* Department (Compulsory) */}
            <div className="field">
              <label style={{ fontWeight: 600, color: 'var(--navy)' }}>
                Department <span style={{ color: 'var(--danger)', fontWeight: 700 }}>* (Compulsory)</span>
              </label>
              <p className="muted text-sm" style={{ marginBottom: 8 }}>
                Please specify your church department before registering for Proclaimers.
              </p>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-building" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', fontSize: '0.95rem'
                }}></i>
                <input
                  type="text"
                  placeholder="e.g. Ushering, Media, Choir, Protocol..."
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            {submitError && (
              <div className="error-box" style={{ marginBottom: 16 }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }}></i>
                {submitError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }}
                onClick={() => { setStep(1); setFoundStudent(null); setQuery(''); }}>
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '14px' }}
                disabled={submitting}>
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Registering…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i> Complete Proclaimers Registration
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3.5rem', color: '#16a34a', marginBottom: 16 }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Registration Complete!</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>{successMsg}</p>
            <div style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 12, padding: '18px 20px', marginBottom: 24
            }}>
              <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <i className="fa-solid fa-bullhorn"></i> Enrolled in Proclaimers · {batch.batch_name}
              </div>
              <div className="muted text-sm">
                Department registered: <strong>{department}</strong>
              </div>
            </div>
            <p className="muted text-sm">You may close this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
