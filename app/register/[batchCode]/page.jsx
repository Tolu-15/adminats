'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import Logo from '../../../components/Logo';
import RegistrationForm from '../../../components/RegistrationForm';
import Toast from '../../../components/Toast';
import { getImageUrl } from '../../../lib/getImageUrl';

const initialMemForm = {
  surname: '', first_name: '', middle_name: '', email: '', phone: '',
  date_of_birth: '', gender: '', is_first_timer: 'No', home_address: '', next_of_kin: '',
  next_of_kin_relationship: '', next_of_kin_phone: '', state_of_origin: '', local_government: '', nationality: '', education: '',
  born_again: '', born_again_details: '', baptized_water: '', baptized_water_details: '',
  baptized_holy_spirit: '', baptized_holy_spirit_details: '', church_join_date: '', challenges: '',
};

export default function RegisterPage() {
  const { batchCode } = useParams();
  const [batch, setBatch] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound

  // Selected Programme Type ('MEMBERSHIP' | 'MIT' | 'PROCLAIMERS')
  const [programme, setProgramme] = useState('MEMBERSHIP');

  // --- 1. MEMBERSHIP STATE ---
  // 'new' | 'retake'
  const [memMode, setMemMode] = useState('new');
  const [memForm, setMemForm] = useState(initialMemForm);
  const [memPhotoFile, setMemPhotoFile] = useState(null); // compressed photo file to upload on submit
  const [memPhotoUrl, setMemPhotoUrl] = useState('');  // uploaded photo URL
  const [memSubmitting, setMemSubmitting] = useState(false);
  const [memError, setMemError] = useState('');
  const [memToast, setMemToast] = useState('');
  const [memResult, setMemResult] = useState(null);

  // Retake lookup state
  const [retakeQuery, setRetakeQuery] = useState('');
  const [retakeLookupLoading, setRetakeLookupLoading] = useState(false);
  const [retakeLookupError, setRetakeLookupError] = useState('');
  const [retakeStudent, setRetakeStudent] = useState(null); // found student info
  const [retakeSubmitting, setRetakeSubmitting] = useState(false);
  const [retakeError, setRetakeError] = useState('');
  const [retakeResult, setRetakeResult] = useState(null);

  // --- 2. MIT / PROCLAIMERS LOOKUP & SUBMISSION STATE ---
  const [lookupStep, setLookupStep] = useState(1); // 1 = search, 2 = confirm, 3 = success
  const [query, setQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundStudent, setFoundStudent] = useState(null);
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load batch details
  useEffect(() => {
    async function loadBatch() {
      try {
        const res = await fetch(`/api/batches/public?token=${encodeURIComponent(batchCode)}`);
        const json = await res.json();
        if (!res.ok || !json.batch) {
          setLoadState('notfound');
        } else {
          setBatch(json.batch);
          if (['MEMBERSHIP', 'MIT', 'PROCLAIMERS'].includes(json.batch.programme_type)) {
            setProgramme(json.batch.programme_type);
          }
          setLoadState('ready');
        }
      } catch {
        setLoadState('notfound');
      }
    }
    if (batchCode) loadBatch();
  }, [batchCode]);

  // Reset sub-flow states when switching programmes
  function handleProgrammeChange(newProg) {
    setProgramme(newProg);
    setLookupStep(1);
    setQuery('');
    setLookupError('');
    setFoundStudent(null);
    setDepartment('');
    setSubmitError('');
    setSuccessMsg('');
    setMemError('');
    setMemToast('');
    setMemResult(null);
    setMemMode('new');
    setRetakeQuery('');
    setRetakeStudent(null);
    setRetakeLookupError('');
    setRetakeError('');
    setRetakeResult(null);
  }

  function switchMemMode(mode) {
    setMemMode(mode);
    setMemError('');
    setMemToast('');
    setMemResult(null);
    setRetakeQuery('');
    setRetakeStudent(null);
    setRetakeLookupError('');
    setRetakeError('');
    setRetakeResult(null);
    setMemForm(initialMemForm);
    setMemPhotoUrl('');
  }

  // --- MEMBERSHIP NEW STUDENT HANDLERS ---
  function updateMemField(field, value) {
    setMemForm((f) => ({ ...f, [field]: value }));
  }

  async function handleMemSubmit(e) {
    e.preventDefault();
    setMemError('');

    const required = ['surname', 'first_name', 'email', 'phone', 'date_of_birth', 'gender', 'is_first_timer'];
    for (const key of required) {
      if (!memForm[key]) {
        setMemError('Please fill in all required fields.');
        return;
      }
    }

    // Age validation — minimum 16 years based on DOB
    if (memForm.date_of_birth) {
      const today = new Date();
      const dob = new Date(memForm.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 16) {
        setMemToast('You must be at least 16 years old to register for Membership.');
        return;
      }
    }

    setMemSubmitting(true);
    try {
      let finalPhotoUrl = memPhotoUrl || null;

      // Upload compressed photo ONLY NOW when student clicks submit
      if (memPhotoFile) {
        const fd = new FormData();
        fd.append('file', memPhotoFile);

        const uploadRes = await fetch('/api/upload-image', {
          method: 'POST',
          body: fd,
        });

        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadJson.error || 'Photo upload failed. Please try again.');
        }
        finalPhotoUrl = uploadJson.publicUrl;
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...memForm, batch_id: batch.id, photo_url: finalPhotoUrl }),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.error || 'Registration failed.';
        if (errorMsg.includes('16 years')) {
          setMemToast(errorMsg);
        } else {
          setMemError(errorMsg);
        }
        return;
      }

      setMemResult(json.student);
    } catch (err) {
      if (err.message && err.message.includes('16 years')) {
        setMemToast(err.message);
      } else {
        setMemError(err.message);
      }
    } finally {
      setMemSubmitting(false);
    }
  }

  // --- MEMBERSHIP RETAKE HANDLERS ---
  async function handleRetakeLookup(e) {
    e.preventDefault();
    setRetakeLookupError('');
    setRetakeStudent(null);
    if (!retakeQuery.trim()) return;

    setRetakeLookupLoading(true);
    try {
      const res = await fetch(`/api/membership/lookup?q=${encodeURIComponent(retakeQuery.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setRetakeLookupError(json.error || 'Student not found.');
      } else {
        setRetakeStudent(json.student);
      }
    } catch {
      setRetakeLookupError('Network error. Please check your connection and try again.');
    } finally {
      setRetakeLookupLoading(false);
    }
  }

  async function handleRetakeSubmit(e) {
    e.preventDefault();
    setRetakeError('');
    setRetakeSubmitting(true);
    try {
      const res = await fetch('/api/membership/retake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.id, query: retakeQuery.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRetakeError(json.error || 'Re-enrolment failed. Please try again.');
      } else {
        setRetakeResult(json);
      }
    } catch {
      setRetakeError('Network error. Please try again.');
    } finally {
      setRetakeSubmitting(false);
    }
  }

  // --- MIT & PROCLAIMERS LOOKUP HANDLERS ---
  async function handleLookup(e) {
    e.preventDefault();
    setLookupError('');
    setFoundStudent(null);
    if (!query.trim()) return;

    setLookupLoading(true);
    const endpoint = programme === 'PROCLAIMERS' ? '/api/proclaimers/lookup' : '/api/mit/lookup';
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 403 && json.student) {
          const statusText = programme === 'PROCLAIMERS'
            ? 'Must complete and pass both Membership & MIT before registering for Proclaimers.'
            : 'Must complete and pass Membership before registering for MIT.';
          setLookupError(`${json.student.name} (${json.student.student_unique_id}) — ${statusText}`);
        } else {
          setLookupError(json.error || 'Student not eligible or record not found.');
        }
      } else {
        setFoundStudent(json.student);
        setLookupStep(2);
      }
    } catch {
      setLookupError('Network error. Please check connection.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleMitProclaimersSubmit(e) {
    e.preventDefault();
    setSubmitError('');

    if (programme === 'PROCLAIMERS' && !department.trim()) {
      setSubmitError('Department is compulsory for Proclaimers registration. Please specify your department.');
      return;
    }

    setSubmitting(true);
    const endpoint = programme === 'PROCLAIMERS' ? '/api/proclaimers/register' : '/api/mit/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.id,
          membership_student_id: foundStudent.id,
          department: department.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Registration failed.');
      } else {
        setSuccessMsg(json.message);
        setLookupStep(3);
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- RENDER STATES ---
  if (loadState === 'loading') {
    return (
      <div className="reg-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#fff', fontSize: '1.1rem' }}>Loading registration form…</p>
      </div>
    );
  }

  if (loadState === 'notfound') {
    return (
      <div className="reg-bg">
        <div className="reg-card" style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16, color: 'var(--gold)' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--navy)', marginBottom: 8 }}>Link Not Found</h1>
          <p className="muted">
            This registration link is invalid or the batch is no longer accepting registrations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-bg">
      <Toast message={memToast} type="error" onClose={() => setMemToast('')} />
      <div className={`reg-card ${programme === 'MEMBERSHIP' ? 'wide' : ''}`} style={{ maxWidth: programme === 'MEMBERSHIP' ? 840 : 580 }}>
        
        {/* --- TOP HEADER & LOGO --- */}
        <div className="reg-header" style={{ marginBottom: 24 }}>
          <Logo size={150} style={{ margin: '0 auto 16px', borderRadius: '20px', display: 'block', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))' }} />
          <h1 style={{ fontSize: '1.75rem', color: 'var(--navy)', margin: '0 0 6px' }}>{batch?.batch_name}</h1>
          <p className="muted text-sm" style={{ marginBottom: 16 }}>Apostolic Training School</p>

          {/* --- PROGRAMME TYPE DROPDOWN SELECTOR --- */}
          <div style={{
            background: 'var(--paper)', border: '1.5px solid var(--border)',
            borderRadius: 14, padding: '14px 18px', maxWidth: 460, margin: '0 auto 12px',
            textAlign: 'left', boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Select Registration Programme:
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={programme}
                onChange={(e) => handleProgrammeChange(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  fontSize: '0.95rem', fontWeight: 700, border: '1.5px solid var(--gold)',
                  background: '#fff', color: 'var(--navy)', cursor: 'pointer'
                }}
              >
                <option value="MEMBERSHIP">🎓 Membership Registration</option>
                <option value="MIT">📖 MIT Registration (Ministers In Training)</option>
                <option value="PROCLAIMERS">📣 Proclaimers Registration</option>
              </select>
            </div>
          </div>
        </div>

        {/* --- PROGRAMME 1: MEMBERSHIP REGISTRATION --- */}
        {programme === 'MEMBERSHIP' && (
          <div>
            {/* Retake / New Student toggle */}
            {!memResult && !retakeResult && (
              <div style={{
                display: 'flex', gap: 0, marginBottom: 28,
                border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden',
              }}>
                <button
                  type="button"
                  onClick={() => switchMemMode('new')}
                  style={{
                    flex: 1, padding: '13px 10px',
                    background: memMode === 'new' ? 'var(--navy)' : '#fff',
                    color: memMode === 'new' ? '#fff' : 'var(--navy)',
                    border: 'none', fontWeight: 700, fontSize: '0.88rem',
                    cursor: 'pointer', transition: 'all 0.2s',
                    borderRight: '1px solid var(--border)',
                  }}
                >
                  <i className="fa-solid fa-user-plus" style={{ marginRight: 7 }}></i>
                  New Student
                </button>
                <button
                  type="button"
                  onClick={() => switchMemMode('retake')}
                  style={{
                    flex: 1, padding: '13px 10px',
                    background: memMode === 'retake' ? 'var(--navy)' : '#fff',
                    color: memMode === 'retake' ? '#fff' : 'var(--navy)',
                    border: 'none', fontWeight: 700, fontSize: '0.88rem',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <i className="fa-solid fa-rotate-right" style={{ marginRight: 7 }}></i>
                  Retake (Existing Student)
                </button>
              </div>
            )}

            {/* NEW STUDENT FLOW */}
            {memMode === 'new' && (
              <>
                {memResult ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '3.5rem', color: '#16a34a', marginBottom: 12 }}>
                      <i className="fa-solid fa-circle-check"></i>
                    </div>
                    <h1 style={{ fontSize: '1.8rem', color: 'var(--navy)', marginBottom: 12 }}>Registration Successful!</h1>
                    <div className="success-box" style={{ marginTop: 16, textAlign: 'left' }}>
                      Welcome, <strong>{memResult.first_name} {memResult.surname}</strong>! Your profile has been successfully created.
                    </div>
                    <div style={{
                      background: 'var(--paper)', border: '1.5px solid var(--gold)',
                      borderRadius: 12, padding: 20, margin: '20px 0', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Your Unique Reg. No.
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--navy)', margin: '6px 0' }}>
                        {memResult.student_unique_id}
                      </div>
                      <div className="muted text-sm">
                        Please save this Reg. No — you will need it for MIT &amp; Proclaimers registrations.
                      </div>
                    </div>
                  </div>
                ) : (
                  <RegistrationForm
                    form={memForm}
                    update={updateMemField}
                    onSubmit={handleMemSubmit}
                    submitting={memSubmitting}
                    error={memError}
                    photoUrl={memPhotoUrl}
                    onPhotoSelected={(file) => setMemPhotoFile(file)}
                    onPhotoUploaded={(url) => setMemPhotoUrl(url)}
                  />
                )}
              </>
            )}

            {/* RETAKE FLOW */}
            {memMode === 'retake' && (
              <div>
                {/* Retake info banner */}
                {!retakeResult && (
                  <div style={{
                    background: 'rgba(212,175,55,0.08)', border: '1.5px solid var(--gold)',
                    borderRadius: 12, padding: '14px 18px', marginBottom: 22,
                    display: 'flex', gap: 12, alignItems: 'flex-start'
                  }}>
                    <i className="fa-solid fa-rotate-right" style={{ color: 'var(--gold)', marginTop: 2, fontSize: '1.05rem' }}></i>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Retake Registration</div>
                      <div className="muted text-sm">
                        If you previously registered for Membership but did not pass or complete the class,
                        enter your Student ID or Card Number below to re-enrol in this batch.
                        Your personal details will be carried over automatically.
                      </div>
                    </div>
                  </div>
                )}

                {!retakeStudent && !retakeResult && (
                  <form onSubmit={handleRetakeLookup}>
                    <div className="field">
                      <label style={{ fontWeight: 600, color: 'var(--navy)' }}>Student ID or Card Number *</label>
                      <p className="muted text-sm" style={{ marginBottom: 10 }}>
                        Enter your existing Membership Student ID (e.g. ATS-055-0001) or card number.
                      </p>
                      <div style={{ position: 'relative' }}>
                        <i className="fa-solid fa-id-card" style={{
                          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--muted)', fontSize: '0.95rem'
                        }}></i>
                        <input
                          type="text"
                          placeholder="e.g. ATS-055-0001 or card number"
                          value={retakeQuery}
                          onChange={(e) => setRetakeQuery(e.target.value)}
                          autoFocus
                          style={{ paddingLeft: 40, fontSize: '1rem', letterSpacing: 0.5 }}
                        />
                      </div>
                    </div>

                    {retakeLookupError && (
                      <div className="error-box" style={{ marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <i className="fa-solid fa-circle-exclamation" style={{ marginTop: 2, flexShrink: 0 }}></i>
                        <div>{retakeLookupError}</div>
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
                      disabled={retakeLookupLoading}
                    >
                      {retakeLookupLoading ? (
                        <><i className="fa-solid fa-spinner fa-spin"></i> Looking up student…</>
                      ) : (
                        <><i className="fa-solid fa-magnifying-glass"></i> Find My Record</>
                      )}
                    </button>
                  </form>
                )}

                {/* Confirm Student Found — show their info, then confirm retake */}
                {retakeStudent && !retakeResult && (
                  <form onSubmit={handleRetakeSubmit}>
                    {/* Student identity card */}
                    <div style={{
                      background: '#fff',
                      border: '1.5px solid var(--gold)',
                      borderRadius: 12, padding: 18, marginBottom: 20,
                      display: 'flex', gap: 14, alignItems: 'center'
                    }}>
                      <div style={{
                        width: 60, height: 60, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem', color: '#fff', fontWeight: 700
                      }}>
                        {retakeStudent.first_name?.[0]}{retakeStudent.surname?.[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--navy)' }}>
                          {retakeStudent.full_name}
                        </div>
                        <div className="muted text-sm">{retakeStudent.student_unique_id}</div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            background: 'rgba(245,158,11,0.15)', color: '#92400e',
                            border: '1px solid rgba(245,158,11,0.4)',
                            borderRadius: 6, padding: '2px 9px', fontSize: '0.7rem', fontWeight: 700
                          }}>
                            🔄 RETAKE — Prev Status: {retakeStudent.previousStatus}
                          </span>
                        </div>
                        <div className="muted text-sm" style={{ marginTop: 6 }}>
                          {retakeStudent.email} {retakeStudent.phone ? `· ${retakeStudent.phone}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(245,158,11,0.06)', border: '1px dashed var(--gold)',
                      borderRadius: 10, padding: '12px 16px', marginBottom: 20
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4, fontSize: '0.9rem' }}>
                        Confirming re-enrolment into:
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '1rem' }}>
                        {batch?.batch_name}
                      </div>
                      <div className="muted text-sm" style={{ marginTop: 4 }}>
                        Your existing personal details will carry over. Your grade record will be reset for this new attempt.
                      </div>
                    </div>

                    {retakeError && (
                      <div className="error-box" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <i className="fa-solid fa-circle-exclamation" style={{ marginTop: 2, flexShrink: 0 }}></i>
                        <div>{retakeError}</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ flex: 1 }}
                        onClick={() => { setRetakeStudent(null); setRetakeQuery(''); }}
                      >
                        ← Back
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ flex: 2, padding: '14px' }}
                        disabled={retakeSubmitting}
                      >
                        {retakeSubmitting ? (
                          <><i className="fa-solid fa-spinner fa-spin"></i> Processing…</>
                        ) : (
                          <><i className="fa-solid fa-rotate-right"></i> Confirm Retake Registration</>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Retake Success */}
                {retakeResult && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '3.5rem', color: '#16a34a', marginBottom: 12 }}>
                      <i className="fa-solid fa-circle-check"></i>
                    </div>
                    <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Re-Enrolment Successful!</h2>
                    <p className="muted" style={{ marginBottom: 20 }}>{retakeResult.message}</p>
                    <div style={{
                      background: 'rgba(245,158,11,0.08)', border: '1.5px solid var(--gold)',
                      borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'left'
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                        {retakeResult.student?.first_name} {retakeResult.student?.surname}
                      </div>
                      <div className="muted text-sm">{retakeResult.student?.student_unique_id}</div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                        <span style={{
                          background: 'rgba(245,158,11,0.15)', color: '#92400e',
                          border: '1px solid rgba(245,158,11,0.4)',
                          borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700
                        }}>
                          🔄 Retake · {batch?.batch_name}
                        </span>
                      </div>
                    </div>
                    <p className="muted text-sm">You may close this page. Attend class as scheduled.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- PROGRAMME 2 & 3: MIT OR PROCLAIMERS FLOW --- */}
        {(programme === 'MIT' || programme === 'PROCLAIMERS') && (
          <div>
            {/* Step Progress Indicator */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {['Verify Identity', 'Department Details', 'Done'].map((label, i) => {
                const isActive = lookupStep === i + 1;
                const isDone = lookupStep > i + 1;
                const accentColor = programme === 'PROCLAIMERS' ? '#8b5cf6' : 'var(--gold)';
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      height: 4, borderRadius: 2, marginBottom: 6,
                      background: isDone || isActive ? accentColor : 'var(--line)',
                      transition: 'background 0.3s',
                    }} />
                    <span style={{
                      fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                      color: isActive ? accentColor : 'var(--muted)'
                    }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Search Student ID */}
            {lookupStep === 1 && (
              <form onSubmit={handleLookup}>
                <div className="field">
                  <label style={{ fontWeight: 600, color: 'var(--navy)' }}>Student ID or CHARTER MEMBERSHIP ID CARD No: *</label>
                  <p className="muted text-sm" style={{ marginBottom: 10 }}>
                    Enter your Membership Student ID (e.g. ATS-055-0001) or Membership Card Number to register for {programme}.
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
                      <i className="fa-solid fa-spinner fa-spin"></i> Verifying Identity…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-magnifying-glass"></i> Check Eligibility &amp; Continue
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Confirm Identity & Department Input */}
            {lookupStep === 2 && foundStudent && (
              <form onSubmit={handleMitProclaimersSubmit}>
                {/* Found Student Identity Card */}
                <div style={{
                  background: '#fff',
                  border: `1.5px solid ${programme === 'PROCLAIMERS' ? '#8b5cf6' : 'var(--gold)'}`,
                  borderRadius: 12, padding: 18, marginBottom: 20,
                  display: 'flex', gap: 14, alignItems: 'center'
                }}>
                  {foundStudent.photo_url ? (
                    <img src={getImageUrl(foundStudent.photo_url)} alt="Photo"
                      style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--gold)' }} />
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', color: '#fff', fontWeight: 700
                    }}>
                      {foundStudent.first_name?.[0]}{foundStudent.surname?.[0]}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--navy)' }}>{foundStudent.full_name}</div>
                    <div className="muted text-sm">{foundStudent.student_unique_id} {foundStudent.card_number ? `· Card: ${foundStudent.card_number}` : ''}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        background: 'rgba(34,197,94,0.15)', color: '#16a34a',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700
                      }}>
                        ✓ MEMBERSHIP PASSED
                      </span>
                      {programme === 'PROCLAIMERS' && (
                        <span style={{
                          background: 'rgba(212,175,55,0.15)', color: 'var(--gold)',
                          border: '1px solid rgba(212,175,55,0.3)',
                          borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700
                        }}>
                          🎓 MIT PASSED
                        </span>
                      )}
                      {/* Show retake badge if it's a repeat MIT attempt */}
                      {programme === 'MIT' && foundStudent.isRetake && (
                        <span style={{
                          background: 'rgba(245,158,11,0.12)', color: '#92400e',
                          border: '1px solid rgba(245,158,11,0.4)',
                          borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700
                        }}>
                          🔄 RETAKE
                        </span>
                      )}
                    </div>
                    {programme === 'MIT' && foundStudent.isRetake && foundStudent.priorAttempts?.length > 0 && (
                      <div className="muted text-sm" style={{ marginTop: 6 }}>
                        Previous MIT attempt(s): {foundStudent.priorAttempts.map(a => `${a.batch} — ${a.status}`).join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Department Input Field */}
                <div className="field">
                  <label style={{ fontWeight: 600, color: 'var(--navy)' }}>
                    Department {programme === 'PROCLAIMERS' ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>* (Compulsory)</span> : <span className="muted font-normal">(Optional)</span>}
                  </label>
                  <p className="muted text-sm" style={{ marginBottom: 8 }}>
                    {programme === 'PROCLAIMERS'
                      ? 'Please specify your church department before completing Proclaimers registration.'
                      : 'Specify your church department (optional).'}
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
                      required={programme === 'PROCLAIMERS'}
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
                    onClick={() => { setLookupStep(1); setFoundStudent(null); setQuery(''); }}>
                    ← Back
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '14px' }} disabled={submitting}>
                    {submitting ? 'Registering…' : `Complete ${programme} Registration`}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Success */}
            {lookupStep === 3 && (
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
                  <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>
                    Enrolled in {programme} · {batch.batch_name}
                  </div>
                  {department && (
                    <div className="muted text-sm">Department: <strong>{department}</strong></div>
                  )}
                </div>
                <p className="muted text-sm">You may close this page.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
