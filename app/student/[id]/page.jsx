'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProfileRow from '../../../components/ProfileRow';
import StatusPill from '../../../components/StatusPill';
import PageLoader from '../../../components/PageLoader';
import Logo from '../../../components/Logo';
import { getImageUrl } from '../../../lib/getImageUrl';

export default function StudentViewerProfile() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [memGrades, setMemGrades] = useState({});
  const [mitReg, setMitReg] = useState(null);
  const [mitGrades, setMitGrades] = useState({});
  const [procReg, setProcReg] = useState(null);
  const [procGrades, setProcGrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('MEMBERSHIP');

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${id}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Student profile not found.');
      }

      setStudent(json.student);
      setMemGrades(json.membershipGrades || {});
      setMitReg(json.mitRegistration || null);
      setMitGrades(json.mitGrades || {});
      setProcReg(json.proclaimersRegistration || null);
      setProcGrades(json.proclaimersGrades || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  if (loading) return <PageLoader />;

  if (error || !student) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div className="error-box">{error || 'Student not found.'}</div>
        <Link href="/" className="btn btn-outline" style={{ marginTop: 16, display: 'inline-block' }}>
          ← Back to Home
        </Link>
      </div>
    );
  }

  const fullName = [student.surname, student.first_name, student.middle_name].filter(Boolean).join(' ');

  // Progression logic
  const memStatus = (memGrades.status || '').toUpperCase();
  const memPassed = memStatus === 'PASSED';
  const mitStatus = (mitGrades.status || '').toUpperCase();
  const mitPassed = mitStatus === 'PASSED';
  const procStatus = (procGrades.status || '').toUpperCase();

  const isFirstTimer = student.is_first_timer === true || student.is_first_timer === 'Yes';

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh', padding: '30px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── HEADER & NAVIGATION ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12, background: '#fff',
          padding: '16px 24px', borderRadius: 16, border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--navy)' }}>
                Apostolic Training School
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                Official Student Profile &amp; Academic Record (Read Only)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'rgba(59,130,246,0.12)', color: '#1d4ed8',
              border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8,
              padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6
            }}>
              <i className="fa-solid fa-eye" /> READ-ONLY VIEWER MODE
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => window.print()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <i className="fa-solid fa-print" /> Print Profile
            </button>
          </div>
        </div>

        {/* ── PROGRESSION TRACKER ── */}
        <div className="card" style={{ marginBottom: 20, padding: '18px 24px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>
            Programme Progression
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Membership */}
            <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#3b82f6' }}>🎓 Membership</span>
                <StatusPill status={memStatus} />
              </div>
              <div className="text-sm muted">Batch: {student.batch?.batch_name || 'N/A'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>ID: {student.student_unique_id}</div>
            </div>

            {/* MIT */}
            <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, borderLeft: `4px solid ${mitReg ? 'var(--gold)' : '#cbd5e1'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--gold)' }}>📖 MIT</span>
                {mitReg ? <StatusPill status={mitStatus} fallback="Enrolled" /> : <span className="badge" style={{ background: '#e2e8f0', color: '#94a3b8', fontSize: '0.7rem' }}>Not Enrolled</span>}
              </div>
              <div className="text-sm muted">{mitReg ? `Batch: ${mitReg.batch?.batch_name}` : 'N/A'}</div>
            </div>

            {/* Proclaimers */}
            <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, borderLeft: `4px solid ${procReg ? '#8b5cf6' : '#cbd5e1'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#8b5cf6' }}>📣 Proclaimers</span>
                {procReg ? <StatusPill status={procStatus} fallback="Enrolled" /> : <span className="badge" style={{ background: '#e2e8f0', color: '#94a3b8', fontSize: '0.7rem' }}>Not Enrolled</span>}
              </div>
              <div className="text-sm muted">{procReg ? `Batch: ${procReg.batch?.batch_name}` : 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* ── MAIN LAYOUT GRID ── */}
        <div className="profile-student-grid">

          {/* ── LEFT: BIODATA ── */}
          <div className="card">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
              {student.photo_url ? (
                <img src={getImageUrl(student.photo_url)} alt="" style={{ width: 72, height: 90, borderRadius: 8, objectFit: 'cover', border: '3px solid var(--gold)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 72, height: 90, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,#E4C875,#B8862E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.3rem' }}>
                  {student.first_name?.[0]}{student.surname?.[0]}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {fullName.toUpperCase()}
                </h1>
                <div style={{ marginTop: 6, display: 'inline-block', textAlign: 'center' }}>
                  <span className="badge badge-gold" style={{ fontSize: '0.78rem', letterSpacing: '1px', fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px' }}>
                    {student.student_unique_id}
                  </span>
                </div>
                {isFirstTimer && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>⭐ First Timer</span>
                  </div>
                )}
              </div>
            </div>

            <div className="section-title">Identity &amp; Card</div>
            <ProfileRow label="Card Number" value={student.card_number || 'Not assigned'} />

            <div className="section-title">Contact Information</div>
            <ProfileRow label="Email" value={student.email} />
            <ProfileRow label="Phone" value={student.phone} />
            <ProfileRow label="Home Address" value={student.home_address} />
            <ProfileRow label="State of Origin" value={student.state_of_origin} />
            <ProfileRow label="Local Government (LGA)" value={student.local_government} />
            <ProfileRow label="Nationality" value={student.nationality} />

            <div className="section-title">Personal Details</div>
            <ProfileRow label="Date of Birth" value={student.date_of_birth} />
            <ProfileRow label="Gender" value={student.gender} />
            <ProfileRow label="Education" value={student.education} />

            <div className="section-title">Next of Kin</div>
            <ProfileRow label="Name" value={student.next_of_kin} />
            <ProfileRow label="Relationship" value={student.next_of_kin_relationship} />
            <ProfileRow label="Phone Number" value={student.next_of_kin_phone} />

            <div className="section-title">Spiritual Journey</div>
            <ProfileRow label="Born Again" value={student.born_again} />
            <ProfileRow label="Water Baptism" value={student.baptized_water ? 'Yes' : 'No'} />
            <ProfileRow label="Holy Spirit Baptism" value={student.baptized_holy_spirit ? 'Yes' : 'No'} />
            <ProfileRow label="Joined Church" value={student.church_join_date} />
          </div>

          {/* ── RIGHT: READ-ONLY GRADES ── */}
          <div>
            {/* Tabs */}
            <div className="profile-tabs-scroll">
              {[
                { id: 'MEMBERSHIP', label: '🎓 Membership Grades' },
                { id: 'MIT', label: `📖 MIT Record${mitReg ? ' ✓' : ''}` },
                { id: 'PROCLAIMERS', label: `📣 Proclaimers Record${procReg ? ' ✓' : ''}` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 16px', fontWeight: activeTab === tab.id ? 700 : 500,
                    fontSize: '0.88rem', border: 'none', background: 'none',
                    borderBottom: activeTab === tab.id ? '3px solid var(--gold)' : '3px solid transparent',
                    color: activeTab === tab.id ? 'var(--navy)' : 'var(--muted)',
                    cursor: 'pointer', marginBottom: -2, transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: MEMBERSHIP GRADES */}
            {activeTab === 'MEMBERSHIP' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--navy)' }}>Membership Grade Record</h3>
                  <StatusPill status={memStatus} />
                </div>

                <div className="grades-grid" style={{ marginBottom: 20 }}>
                  {[
                    { key: 'attendance', label: 'Attendance' },
                    { key: 'test', label: 'Test' },
                    { key: 'assignment', label: 'Assignment' },
                    { key: 'assessment', label: 'Assessment' },
                    { key: 'presentation', label: 'Presentation' },
                    { key: 'exam', label: 'Exam' },
                    { key: 'final_grades', label: 'Final Grade' },
                  ].map(({ key, label }) => (
                    <div className="grade-box" key={key}>
                      <div className="grade-box-label">{label}</div>
                      <div className="grade-box-val">{memGrades[key] ?? '—'}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ProfileRow label="Class Group" value={memGrades.class} />
                  <ProfileRow label="Trainer" value={memGrades.trainer} />
                  <ProfileRow label="Portal Status" value={memGrades.portal} />
                  <ProfileRow label="Covenant Deed" value={memGrades.covenant_deed} />
                  <ProfileRow label="Comments" value={memGrades.comments} />
                </div>
              </div>
            )}

            {/* TAB 2: MIT RECORD */}
            {activeTab === 'MIT' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--navy)' }}>MIT Record</h3>
                  <StatusPill status={mitStatus} />
                </div>

                {mitReg ? (
                  <div>
                    <div className="grades-grid" style={{ marginBottom: 20 }}>
                      {[
                        { key: 'midterm_test', label: 'Midterm Test' },
                        { key: 'interactions', label: 'Interactions' },
                        { key: 'bible_study', label: 'Bible Study' },
                        { key: 'assignment', label: 'Assignment' },
                        { key: 'attendance', label: 'Attendance' },
                        { key: 'final_exam', label: 'Final Exam' },
                        { key: 'final_grades', label: 'Final Grade' },
                      ].map(({ key, label }) => (
                        <div className="grade-box" key={key}>
                          <div className="grade-box-label">{label}</div>
                          <div className="grade-box-val">{mitGrades[key] ?? '—'}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <ProfileRow label="Department" value={mitReg.department || mitGrades.department} />
                      <ProfileRow label="Class Group" value={mitGrades.class} />
                      <ProfileRow label="Trainer" value={mitGrades.trainer} />
                      <ProfileRow label="Comments" value={mitGrades.comments} />
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ padding: 20, textAlign: 'center' }}>No MIT registration record found for this student.</p>
                )}
              </div>
            )}

            {/* TAB 3: PROCLAIMERS RECORD */}
            {activeTab === 'PROCLAIMERS' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--navy)' }}>Proclaimers Record</h3>
                  <StatusPill status={procStatus} />
                </div>

                {procReg ? (
                  <div>
                    <div className="grades-grid" style={{ marginBottom: 20 }}>
                      {[
                        { key: 'attendance', label: 'Attendance' },
                        { key: 'assignment', label: 'Assignment' },
                        { key: 'assessment', label: 'Assessment' },
                        { key: 'presentation', label: 'Presentation' },
                        { key: 'exam', label: 'Project / Exam' },
                        { key: 'final_grades', label: 'Final Grade' },
                      ].map(({ key, label }) => (
                        <div className="grade-box" key={key}>
                          <div className="grade-box-label">{label}</div>
                          <div className="grade-box-val">{procGrades[key] ?? '—'}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <ProfileRow label="Department" value={procReg.department || procGrades.department} />
                      <ProfileRow label="Class Group" value={procGrades.class} />
                      <ProfileRow label="Trainer" value={procGrades.trainer} />
                      <ProfileRow label="Comments" value={procGrades.comments} />
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ padding: 20, textAlign: 'center' }}>No Proclaimers registration record found for this student.</p>
                )}
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
