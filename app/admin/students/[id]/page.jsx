'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { useAdminGuard } from '../../../../lib/useAdminGuard';
import Sidebar from '../../../../components/Sidebar';
import ProfileRow from '../../../../components/ProfileRow';
import GradeEditForm from '../../../../components/GradeEditForm';
import MitGradeEditForm from '../../../../components/MitGradeEditForm';

const MEM_GRADE_FIELDS = [
  { key: 'class',               label: 'Class' },
  { key: 'trainer',             label: 'Trainer' },
  { key: 'attendance',          label: 'Attendance' },
  { key: 'test',                label: 'Test' },
  { key: 'assignment',          label: 'Assignment' },
  { key: 'assessment',          label: 'Assessment' },
  { key: 'presentation',        label: 'Presentation' },
  { key: 'exam',                label: 'Exam' },
  { key: 'final_grades',        label: 'Final Grades' },
  { key: 'water_baptism',       label: 'Water Baptism' },
  { key: 'holy_spirit_baptism', label: 'Holy Spirit Baptism' },
  { key: 'portal',              label: 'Portal' },
  { key: 'status',              label: 'Status' },
  { key: 'comments',            label: 'Comments' },
  { key: 'covenant_deed',       label: 'Covenant Deed' },
];

export default function StudentProfile() {
  const session = useAdminGuard();
  const { id } = useParams();

  const [student, setStudent] = useState(null);
  const [memGrades, setMemGrades] = useState(null);
  const [mitReg, setMitReg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('MEMBERSHIP'); // 'MEMBERSHIP' | 'MIT'

  const [editingMemGrades, setEditingMemGrades] = useState(false);
  const [editingCard, setEditingCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  async function loadData(token) {
    setLoading(true);
    const res = await fetch(`/api/students/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) {
      setStudent(json.student);
      setMemGrades(json.membershipGrades || {});
      setMitReg(json.mitRegistration || null);
      setCardNumber(json.student?.card_number || '');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (session) loadData(session.access_token);
  }, [session, id]);

  async function handleSaveCard(e) {
    e.preventDefault();
    setSavingCard(true);
    const { data: { session: sess } } = await supabase.auth.getSession();
    const token = sess?.access_token || session?.access_token;
    const res = await fetch(`/api/students/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ card_number: cardNumber.trim() }),
    });
    const json = await res.json();
    setSavingCard(false);
    if (res.ok) {
      setStudent(json.student);
      setEditingCard(false);
    } else {
      alert(json.error || 'Failed to update card number');
    }
  }

  if (session === undefined || loading) {
    return (
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="muted">Loading student profile…</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="admin-shell">
        <Sidebar />
        <div className="admin-main">
          <div className="admin-content">
            <div className="error-box">Student profile not found.</div>
          </div>
        </div>
      </div>
    );
  }

  // Status checks
  const memStatus = (memGrades?.status || '').toString().trim().toUpperCase();
  const memPassed = memStatus === 'PASSED';
  const mitGrades = mitReg?.mit_grades?.[0] || {};
  const mitStatus = (mitGrades?.status || '').toString().trim().toUpperCase();
  const mitPassed = mitStatus === 'PASSED';

  function renderStatusPill(status, defaultText = 'Pending') {
    if (!status) return <span className="grade-pill pending">{defaultText}</span>;
    const cls = status === 'PASSED' ? 'passed' : status === 'FAILED' ? 'failed' : 'pending';
    return <span className={`grade-pill ${cls}`}>{status}</span>;
  }

  const fullName = [student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ');

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        {/* Top bar */}
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {student.batch && (
              <Link href={`/admin/batch/${student.batch.id}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>
                ← {student.batch.batch_name}
              </Link>
            )}
            <div className="admin-topbar-title">Student Unified Profile</div>
          </div>
          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">

          {/* ── PROGRAMME PROGRESSION HEADER TRACKER ── */}
          <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 14 }}>
              Progression Journey
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>

              {/* 1. Membership */}
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 14, borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#3b82f6' }}>🎓 Membership</span>
                  {renderStatusPill(memStatus)}
                </div>
                <div className="text-sm muted">Batch: {student.batch ? student.batch.batch_name : 'N/A'}</div>
                <div className="text-sm muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>ID: {student.student_unique_id}</div>
              </div>

              {/* 2. MIT */}
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 14,
                borderLeft: `4px solid ${mitReg ? 'var(--gold)' : memPassed ? '#64748b' : '#cbd5e1'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gold)' }}>📖 MIT</span>
                  {mitReg ? (
                    renderStatusPill(mitStatus, 'Enrolled')
                  ) : memPassed ? (
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>Eligible</span>
                  ) : (
                    <span className="badge" style={{ background: '#cbd5e1', color: '#475569', fontSize: '0.7rem' }}>Locked</span>
                  )}
                </div>
                <div className="text-sm muted">
                  {mitReg ? `Batch: ${mitReg.batch?.batch_name}` : memPassed ? 'Ready for enrolment' : 'Must pass Membership'}
                </div>
                {mitReg?.department && (
                  <div className="text-sm muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>Dept: {mitReg.department}</div>
                )}
              </div>

              {/* 3. Proclaimers */}
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 14,
                borderLeft: `4px solid ${mitPassed ? '#8b5cf6' : '#cbd5e1'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#8b5cf6' }}>📣 Proclaimers</span>
                  {mitPassed ? (
                    <span className="badge" style={{ background: '#8b5cf6', color: '#fff', fontSize: '0.7rem' }}>Eligible</span>
                  ) : (
                    <span className="badge" style={{ background: '#cbd5e1', color: '#475569', fontSize: '0.7rem' }}>Locked</span>
                  )}
                </div>
                <div className="text-sm muted">{mitPassed ? 'Ready for Proclaimers' : 'Must complete MIT'}</div>
              </div>

            </div>
          </div>


          <div className="profile-student-grid" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── LEFT: STUDENT BIODATA ── */}
            <div>
              <div className="card">
                {/* Header */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                  {student.photo_url ? (
                    <img src={student.photo_url} alt="" style={{
                      width: 76, height: 76, borderRadius: '50%', objectFit: 'cover',
                      border: '3px solid var(--gold)', flexShrink: 0
                    }} />
                  ) : (
                    <div style={{
                      width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #E4C875, #B8862E)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: '1.4rem',
                    }}>
                      {student.first_name?.[0]}{student.surname?.[0]}
                    </div>
                  )}
                  <div>
                    <h1 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--navy)' }}>{fullName}</h1>
                    <span className="badge badge-gold" style={{ marginTop: 4, fontSize: '0.78rem' }}>{student.student_unique_id}</span>
                  </div>
                </div>

                <div className="section-title">Identity &amp; Card</div>
                <div className="profile-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="profile-row-label">Card Number: </span>
                    {editingCard ? (
                      <form onSubmit={handleSaveCard} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="e.g. CARD-12345"
                          style={{ padding: '4px 8px', fontSize: '0.85rem', width: 130 }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" disabled={savingCard}>
                          Save
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingCard(false)}>
                          ✕
                        </button>
                      </form>
                    ) : (
                      <span className="profile-row-value" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {student.card_number || <span className="muted">Not assigned</span>}
                      </span>
                    )}
                  </div>
                  {!editingCard && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingCard(true)} style={{ fontSize: '0.75rem' }}>
                      ✏️ {student.card_number ? 'Edit' : 'Assign'}
                    </button>
                  )}
                </div>

                <div className="section-title">Contact Information</div>
                <ProfileRow label="Email" value={student.email} />
                <ProfileRow label="Phone" value={student.phone} />
                <ProfileRow label="Home Address" value={student.home_address} />
                <ProfileRow label="State of Origin" value={student.state_of_origin} />
                <ProfileRow label="Nationality" value={student.nationality} />

                <div className="section-title">Personal Details</div>
                <ProfileRow label="Date of Birth" value={student.date_of_birth} />
                <ProfileRow label="Gender" value={student.gender} />
                <ProfileRow label="Education" value={student.education} />

                <div className="section-title">Next of Kin</div>
                <ProfileRow label="Name" value={student.next_of_kin} />
                <ProfileRow label="Address" value={student.next_of_kin_address} />

                <div className="section-title">Spiritual Journey</div>
                <ProfileRow label="Born Again" value={student.born_again} />
                <ProfileRow label="Water Baptism" value={student.baptized_water ? 'Yes' : 'No'} />
                <ProfileRow label="Holy Spirit Baptism" value={student.baptized_holy_spirit ? 'Yes' : 'No'} />
                <ProfileRow label="Joined Church" value={student.church_join_date} />
              </div>
            </div>

            {/* ── RIGHT: PROGRAMME ACADEMIC RECORDS & GRADES ── */}
            <div>
              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => setActiveTab('MEMBERSHIP')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem',
                    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.2s',
                    borderColor: activeTab === 'MEMBERSHIP' ? '#3b82f6' : 'var(--border)',
                    background: activeTab === 'MEMBERSHIP' ? 'rgba(59,130,246,0.1)' : 'var(--paper)',
                    color: activeTab === 'MEMBERSHIP' ? '#3b82f6' : 'var(--muted)',
                  }}
                >
                  🎓 Membership Grade Record
                </button>

                <button
                  onClick={() => setActiveTab('MIT')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem',
                    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.2s',
                    borderColor: activeTab === 'MIT' ? 'var(--gold)' : 'var(--border)',
                    background: activeTab === 'MIT' ? 'rgba(212,175,55,0.1)' : 'var(--paper)',
                    color: activeTab === 'MIT' ? 'var(--gold)' : 'var(--muted)',
                  }}
                >
                  📖 MIT Grade Record {mitReg ? '✓' : ''}
                </button>
              </div>

              {/* ── TAB 1: MEMBERSHIP RECORD ── */}
              {activeTab === 'MEMBERSHIP' && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--navy)' }}>🎓 Membership Class Grades</h2>
                      <p className="muted text-sm" style={{ marginTop: 2 }}>Batch: {student.batch?.batch_name}</p>
                    </div>
                    <button
                      className={`btn btn-sm ${editingMemGrades ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => setEditingMemGrades((v) => !v)}
                    >
                      {editingMemGrades ? 'Cancel' : '✏️ Edit Membership Grades'}
                    </button>
                  </div>

                  {editingMemGrades ? (
                    <GradeEditForm
                      studentId={id}
                      initialGrades={memGrades}
                      onSaved={(g) => {
                        setMemGrades(g);
                        setEditingMemGrades(false);
                        loadData(session.access_token);
                      }}
                    />
                  ) : (
                    <>
                      <div className="grades-grid">
                        {['attendance', 'test', 'assignment', 'assessment', 'presentation', 'exam', 'final_grades'].map((key) => (
                          <div className="grade-box" key={key}>
                            <div className="grade-box-label">{key.replace(/_/g, ' ')}</div>
                            <div className={`grade-box-value ${memGrades[key] == null ? 'empty' : ''}`}>
                              {memGrades[key] ?? '—'}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="section-title" style={{ marginTop: 16 }}>Additional Details</div>
                      {MEM_GRADE_FIELDS.filter(f => !['attendance','test','assignment','assessment','presentation','exam','final_grades'].includes(f.key)).map(({ key, label }) => (
                        <div className="profile-row" key={key}>
                          <span className="profile-row-label">{label}</span>
                          <span className="profile-row-value">
                            {key === 'status' ? renderStatusPill(memStatus) : (memGrades[key] || <span className="muted">—</span>)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── TAB 2: MIT RECORD ── */}
              {activeTab === 'MIT' && (
                <div>
                  {mitReg ? (
                    <MitGradeEditForm
                      registrationId={mitReg.id}
                      initialGrades={mitGrades}
                      session={session}
                      onSaved={() => loadData(session.access_token)}
                    />
                  ) : (
                    <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📖</div>
                      {memPassed ? (
                        <>
                          <h3 style={{ color: 'var(--navy)', marginBottom: 8 }}>Eligible for MIT</h3>
                          <p className="muted text-sm" style={{ maxWidth: 420, margin: '0 auto 16px' }}>
                            {fullName} has passed Membership class and is eligible to register for MIT!
                          </p>
                          <p className="text-sm muted">
                            Share an active MIT registration link with the student to complete enrolment.
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 style={{ color: 'var(--muted)', marginBottom: 8 }}>MIT Enrolment Locked</h3>
                          <p className="muted text-sm" style={{ maxWidth: 420, margin: '0 auto' }}>
                            This student must pass Membership class before registering for MIT.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
