'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { useAdminGuard } from '../../../../lib/useAdminGuard';
import Sidebar from '../../../../components/Sidebar';
import ProfileRow from '../../../../components/ProfileRow';
import MitGradeEditForm from '../../../../components/MitGradeEditForm';
import ProclaimersGradeEditForm from '../../../../components/ProclaimersGradeEditForm';
import PageLoader from '../../../../components/PageLoader';
import PhotoUploader from '../../../../components/PhotoUploader';
import { getImageUrl } from '../../../../lib/getImageUrl';

const SCORE_FIELDS = [
  { key: 'attendance',   label: 'Attendance' },
  { key: 'test',         label: 'Test' },
  { key: 'assignment',   label: 'Assignment' },
  { key: 'assessment',   label: 'Assessment' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'exam',         label: 'Exam' },
  { key: 'final_grades', label: 'Final Grades' },
];

const EXTRA_FIELDS = [
  { key: 'class',               label: 'Class',               type: 'text' },
  { key: 'trainer',             label: 'Trainer',             type: 'text' },
  { key: 'water_baptism',       label: 'Water Baptism',       type: 'select', options: ['', 'YES', 'NO'] },
  { key: 'holy_spirit_baptism', label: 'Holy Spirit Baptism', type: 'select', options: ['', 'YES', 'NO'] },
  { key: 'portal',              label: 'Portal',              type: 'text' },
  { key: 'status',              label: 'Status',              type: 'select', options: ['', 'IN_PROGRESS', 'PASSED', 'FAILED', 'DROP'] },
  { key: 'covenant_deed',       label: 'Covenant Deed',       type: 'select', options: ['', 'SIGNED', 'NOT SIGNED'] },
  { key: 'id_card_collected_date', label: 'ID Card Collected Date', type: 'date' },
  { key: 'comments',            label: 'Comments',            type: 'textarea' },
];

export default function StudentProfile() {
  const session = useAdminGuard();
  const { id } = useParams();
  const router = useRouter();

  const [student, setStudent] = useState(null);
  const [memGrades, setMemGrades] = useState({});
  const [mitReg, setMitReg] = useState(null);
  const [procReg, setProcReg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Grades editing
  const [editingGrades, setEditingGrades] = useState(false);
  const [gradeForm, setGradeForm] = useState({});
  const [savingGrades, setSavingGrades] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Card editing
  const [editingCard, setEditingCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [savingCard, setSavingCard] = useState(false);


  // Active right-panel tab
  const [activeTab, setActiveTab] = useState('MEMBERSHIP');

  // Full profile edit modal
  const [fullEditOpen, setFullEditOpen] = useState(false);
  const [fullEditForm, setFullEditForm] = useState({});
  const [fullEditPhotoFile, setFullEditPhotoFile] = useState(null);
  const [fullEditPhotoUrl, setFullEditPhotoUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['MEMBERSHIP', 'MIT', 'PROCLAIMERS'].includes(tabParam.toUpperCase())) {
        setActiveTab(tabParam.toUpperCase());
      }
    }
  }, []);

  async function loadData(token) {
    setLoading(true);
    const res = await fetch(`/api/students/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) {
      setStudent(json.student);
      const g = json.membershipGrades || {};
      setMemGrades(g);
      setGradeForm(g);
      setMitReg(json.mitRegistration || null);
      setProcReg(json.proclaimersRegistration || null);
      setCardNumber(json.student?.card_number || '');
      // Populate full edit form
      const s = json.student || {};
      setFullEditForm({
        surname: s.surname || '',
        first_name: s.first_name || '',
        middle_name: s.middle_name || '',
        gender: s.gender || '',
        date_of_birth: s.date_of_birth || '',
        email: s.email || '',
        phone: s.phone || '',
        home_address: s.home_address || '',
        state_of_origin: s.state_of_origin || '',
        local_government: s.local_government || '',
        nationality: s.nationality || '',
        education: s.education || '',
        challenges: s.challenges || '',
        church_join_date: s.church_join_date || '',
        next_of_kin: s.next_of_kin || '',
        next_of_kin_relationship: s.next_of_kin_relationship || '',
        next_of_kin_phone: s.next_of_kin_phone || '',
        next_of_kin_address: s.next_of_kin_address || '',
        born_again: s.born_again || '',
        born_again_details: s.born_again_details || '',
        baptized_water: s.baptized_water ? 'Yes' : (s.baptized_water === false ? 'No' : ''),
        baptized_water_details: s.baptized_water_details || '',
        baptized_holy_spirit: s.baptized_holy_spirit ? 'Yes' : (s.baptized_holy_spirit === false ? 'No' : ''),
        baptized_holy_spirit_details: s.baptized_holy_spirit_details || '',
        is_first_timer: s.is_first_timer === true || s.is_first_timer === 'Yes' ? 'Yes' : 'No',
      });
      setFullEditPhotoUrl(s.photo_url || '');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (session) loadData(session.access_token);
  }, [session, id]);

  useEffect(() => {
    setGradeForm(memGrades);
  }, [memGrades]);

  function startEditing() {
    setGradeForm({ ...memGrades });
    setSaveMsg(null);
    setEditingGrades(true);
  }

  function cancelEditing() {
    setGradeForm({ ...memGrades });
    setEditingGrades(false);
    setSaveMsg(null);
  }

  async function saveGrades() {
    setSavingGrades(true);
    setSaveMsg(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;
      const res = await fetch(`/api/students/${id}/grades`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(gradeForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setMemGrades(json.grades);
      setGradeForm(json.grades);
      setEditingGrades(false);
      setSaveMsg({ type: 'success', text: 'Grades saved.' });
      setTimeout(() => setSaveMsg(null), 3000);
      router.refresh();
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message });
    } finally {
      setSavingGrades(false);
    }
  }

  async function handleSaveCard(e) {
    e.preventDefault();
    setSavingCard(true);
    const { data: { session: sess } } = await supabase.auth.getSession();
    const token = sess?.access_token || session?.access_token;
    const res = await fetch(`/api/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  async function handleSaveFullProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token || session?.access_token;
      const payload = { ...fullEditForm };

      // Upload newly selected compressed photo on Submit
      if (fullEditPhotoFile) {
        const fd = new FormData();
        fd.append('file', fullEditPhotoFile);
        const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: fd });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadJson.error || 'Photo upload failed.');
        payload.photo_url = uploadJson.publicUrl;
      } else if (fullEditPhotoUrl) {
        payload.photo_url = fullEditPhotoUrl;
      }

      const res = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setStudent(json.student);
      setFullEditOpen(false);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
      setTimeout(() => setProfileMsg(null), 4000);
      router.refresh();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  }

  function openFullEdit() {
    const s = student || {};
    setFullEditForm({
      surname: s.surname || '',
      first_name: s.first_name || '',
      middle_name: s.middle_name || '',
      gender: s.gender || '',
      date_of_birth: s.date_of_birth || '',
      email: s.email || '',
      phone: s.phone || '',
      home_address: s.home_address || '',
      state_of_origin: s.state_of_origin || '',
      local_government: s.local_government || '',
      nationality: s.nationality || '',
      education: s.education || '',
      challenges: s.challenges || '',
      church_join_date: s.church_join_date || '',
      next_of_kin: s.next_of_kin || '',
      next_of_kin_relationship: s.next_of_kin_relationship || '',
      next_of_kin_phone: s.next_of_kin_phone || '',
      next_of_kin_address: s.next_of_kin_address || '',
      born_again: s.born_again || '',
      born_again_details: s.born_again_details || '',
      baptized_water: s.baptized_water ? 'Yes' : (s.baptized_water === false ? 'No' : ''),
      baptized_water_details: s.baptized_water_details || '',
      baptized_holy_spirit: s.baptized_holy_spirit ? 'Yes' : (s.baptized_holy_spirit === false ? 'No' : ''),
      baptized_holy_spirit_details: s.baptized_holy_spirit_details || '',
      is_first_timer: s.is_first_timer === true || s.is_first_timer === 'Yes' ? 'Yes' : 'No',
    });
    setFullEditPhotoUrl(s.photo_url || '');
    setFullEditPhotoFile(null);
    setProfileMsg(null);
    setFullEditOpen(true);
  }


  if (session === undefined || loading) {
    return <PageLoader />;
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

  const memStatus = (memGrades?.status || '').toString().trim().toUpperCase();
  const memPassed = memStatus === 'PASSED';

  // Detect retake from comments field
  const isMemRetake = (memGrades?.comments || '').toUpperCase().startsWith('RETAKE');

  const mitGrades = mitReg?.mit_grades?.[0] || {};
  const mitStatus = (mitGrades?.status || '').toString().trim().toUpperCase();
  const mitPassed = mitStatus === 'PASSED';
  const isMitRetake = (mitGrades?.comments || '').toUpperCase().startsWith('RETAKE');

  const procGrades = procReg?.proclaimers_grades?.[0] || {};
  const procStatus = (procGrades?.status || '').toString().trim().toUpperCase();

  const fullName = [student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ');

  const isFirstTimer = student.is_first_timer === true || student.is_first_timer === 'Yes';

  function StatusPill({ status, fallback = 'Pending' }) {
    if (!status) return <span className="grade-pill pending">{fallback}</span>;
    if (status === 'PASSED') return <span className="grade-pill passed">PASSED</span>;
    if (status === 'FAILED' || status === 'DROP') return <span className="grade-pill failed">DROP</span>;
    if (status === 'IN_PROGRESS') return <span className="grade-pill in-progress">IN PROGRESS</span>;
    return <span className="grade-pill pending">{fallback}</span>;
  }

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
            <div className="admin-topbar-title">Student Profile</div>
          </div>
          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session?.isViewer ? (
              <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 10px', fontSize: '0.75rem' }}>
                👁️ Viewer Account (Read Only)
              </span>
            ) : (
              <span className="badge badge-gold" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                ⚡ Super Admin
              </span>
            )}
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">

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
                  {mitReg
                    ? <StatusPill status={mitStatus} fallback="Enrolled" />
                    : memPassed
                      ? <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>Eligible</span>
                      : <span className="badge" style={{ background: '#e2e8f0', color: '#94a3b8', fontSize: '0.7rem' }}>Locked</span>
                  }
                </div>
                <div className="text-sm muted">
                  {mitReg ? `Batch: ${mitReg.batch?.batch_name}` : memPassed ? 'Ready for enrolment' : 'Must pass Membership'}
                </div>
              </div>

              {/* Proclaimers */}
              <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, borderLeft: `4px solid ${procReg ? '#8b5cf6' : '#cbd5e1'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#8b5cf6' }}>📣 Proclaimers</span>
                  {procReg
                    ? <StatusPill status={procStatus} fallback="Enrolled" />
                    : mitPassed
                      ? <span className="badge" style={{ background: '#8b5cf6', color: '#fff', fontSize: '0.7rem' }}>Eligible</span>
                      : <span className="badge" style={{ background: '#e2e8f0', color: '#94a3b8', fontSize: '0.7rem' }}>Locked</span>
                  }
                </div>
                <div className="text-sm muted">
                  {procReg ? `Batch: ${procReg.batch?.batch_name}` : mitPassed ? 'Ready for Proclaimers' : 'Must complete MIT'}
                </div>
              </div>

            </div>
          </div>

          {/* ── MAIN GRID ── */}
          <div className="profile-student-grid">
            <div className="card">
              {/* Avatar + name + Edit button */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
                {student.photo_url ? (
                  <img src={getImageUrl(student.photo_url)} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--gold)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#E4C875,#B8862E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.3rem' }}>
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
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {isFirstTimer && (
                      <span style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>⭐ First Timer</span>
                    )}
                    {isMemRetake && (
                      <span style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>🔄 Membership Retake</span>
                    )}
                    {isMitRetake && (
                      <span style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>🔄 MIT Retake</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Full Profile button (Admin Only) */}
              {!session?.isViewer && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  {profileMsg && (
                    <span style={{ fontSize: '0.78rem', color: profileMsg.type === 'success' ? '#16a34a' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className={`fa-solid ${profileMsg.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
                      {profileMsg.text}
                    </span>
                  )}
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={openFullEdit}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <i className="fa-solid fa-pen-to-square" /> Edit Full Profile
                  </button>
                </div>
              )}

              <div className="section-title">Identity &amp; Card</div>
              <div className="profile-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="profile-row-label">Card Number: </span>
                  {editingCard ? (
                    <form onSubmit={handleSaveCard} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="e.g. CARD-12345" style={{ padding: '4px 8px', fontSize: '0.85rem', width: 130 }} autoFocus />
                      <button className="btn btn-primary btn-sm" disabled={savingCard}>Save</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingCard(false)}>✕</button>
                    </form>
                  ) : (
                    <span className="profile-row-value" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      {student.card_number || <span className="muted">Not assigned</span>}
                    </span>
                  )}
                </div>
                {!session?.isViewer && !editingCard && (
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
              <ProfileRow label="Local Government (LGA)" value={student.local_government} />
              <ProfileRow label="Nationality" value={student.nationality} />

              <div className="section-title">Personal Details</div>
              <ProfileRow label="First Timer" value={isFirstTimer ? '⭐ Yes — First Timer' : 'No — Regular Member'} />
              {isMemRetake && <ProfileRow label="Membership" value="🔄 Retake Student" />}
              {isMitRetake && <ProfileRow label="MIT" value="🔄 Retake Student" />}
              <ProfileRow label="Date of Birth" value={student.date_of_birth} />
              <ProfileRow label="Gender" value={student.gender} />
              <ProfileRow label="Education" value={student.education} />

              <div className="section-title">Next of Kin</div>
              <ProfileRow label="Name" value={student.next_of_kin} />
              <ProfileRow label="Relationship" value={
                student.next_of_kin_relationship ||
                (student.next_of_kin_address?.includes('Rel: ') ? student.next_of_kin_address.split('Rel: ')[1]?.split(' | ')[0] : null)
              } />
              <ProfileRow label="Phone Number" value={
                student.next_of_kin_phone ||
                (student.next_of_kin_address?.includes('Phone: ') ? student.next_of_kin_address.split('Phone: ')[1] : null)
              } />

              <div className="section-title">Spiritual Journey</div>
              <ProfileRow label="Born Again" value={student.born_again} />
              <ProfileRow label="Water Baptism" value={student.baptized_water ? 'Yes' : 'No'} />
              <ProfileRow label="Holy Spirit Baptism" value={student.baptized_holy_spirit ? 'Yes' : 'No'} />
              <ProfileRow label="Joined Church" value={student.church_join_date} />
            </div>

            {/* ── RIGHT: GRADES ── */}
            <div>
              {/* Plain underline tabs */}
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
                      padding: '10px 18px', background: 'none', border: 'none',
                      borderBottom: activeTab === tab.id ? '2px solid var(--navy)' : '2px solid transparent',
                      marginBottom: '-2px',
                      fontWeight: activeTab === tab.id ? 700 : 500,
                      color: activeTab === tab.id ? 'var(--navy)' : 'var(--muted)',
                      cursor: 'pointer', fontSize: '0.88rem', transition: 'all 0.15s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── MEMBERSHIP GRADES TAB ── */}
              {activeTab === 'MEMBERSHIP' && (
                <div className="card">
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--navy)' }}>Membership Class Grades</h2>
                      <p className="muted text-sm" style={{ marginTop: 2 }}>Batch: {student.batch?.batch_name}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {saveMsg && (
                        <span style={{ fontSize: '0.8rem', color: saveMsg.type === 'success' ? '#16a34a' : '#dc2626' }}>
                          {saveMsg.text}
                        </span>
                      )}
                      {!session?.isViewer && (
                        editingGrades ? (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={cancelEditing}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={saveGrades} disabled={savingGrades}>
                              {savingGrades ? 'Saving…' : '💾 Save'}
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={startEditing}>✏️ Edit Grades</button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Score grid */}
                  <div className="grades-grid" style={{ marginBottom: 20 }}>
                    {SCORE_FIELDS.map(({ key, label }) => (
                      <div className="grade-box" key={key}>
                        <div className="grade-box-label">{label}</div>
                        {editingGrades ? (
                          <input
                            type="number"
                            value={gradeForm[key] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setGradeForm((p) => {
                                const next = { ...p, [key]: val };
                                // Auto-set IN_PROGRESS when a score is entered and status is blank
                                if (val !== '' && val !== null && !next.status) {
                                  next.status = 'IN_PROGRESS';
                                }
                                return next;
                              });
                            }}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '1rem', fontWeight: 700, textAlign: 'center', border: '1.5px solid var(--gold)', borderRadius: 6, background: 'var(--paper)' }}
                          />
                        ) : (
                          <div className={`grade-box-value ${memGrades[key] == null ? 'empty' : ''}`}>
                            {memGrades[key] ?? '—'}
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
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                        {editingGrades ? (
                          type === 'select' ? (
                            <select
                              value={gradeForm[key] || ''}
                              onChange={(e) => setGradeForm((p) => ({ ...p, [key]: e.target.value }))}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
                            >
                              {options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                            </select>
                          ) : type === 'textarea' ? (
                            <textarea
                              value={gradeForm[key] || ''}
                              onChange={(e) => setGradeForm((p) => ({ ...p, [key]: e.target.value }))}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.85rem', minHeight: 60, resize: 'vertical' }}
                            />
                          ) : (
                            <input
                              type={type === 'date' ? 'date' : 'text'}
                              value={gradeForm[key] || ''}
                              onChange={(e) => setGradeForm((p) => ({ ...p, [key]: e.target.value }))}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
                            />
                          )
                        ) : (
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--navy)' }}>
                            {key === 'status'
                              ? <StatusPill status={memStatus} />
                              : (memGrades[key] || <span className="muted">—</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── MIT GRADES TAB ── */}
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
                    <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📖</div>
                      {memPassed ? (
                        <>
                          <h3 style={{ color: 'var(--navy)', marginBottom: 8 }}>Eligible for MIT</h3>
                          <p className="muted text-sm" style={{ maxWidth: 420, margin: '0 auto 16px' }}>
                            {fullName} has passed Membership and is eligible to register for MIT.
                          </p>
                          <p className="text-sm muted">Share an active MIT registration link with the student to complete enrolment.</p>
                        </>
                      ) : (
                        <>
                          <h3 style={{ color: 'var(--muted)', marginBottom: 8 }}>MIT Enrolment Locked</h3>
                          <p className="muted text-sm" style={{ maxWidth: 420, margin: '0 auto' }}>
                            This student must pass Membership before registering for MIT.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── PROCLAIMERS GRADES TAB ── */}
              {activeTab === 'PROCLAIMERS' && (
                <div>
                  {procReg ? (
                    <ProclaimersGradeEditForm
                      registrationId={procReg.id}
                      initialGrades={procGrades}
                      session={session}
                      onSaved={() => loadData(session.access_token)}
                    />
                  ) : (
                    <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📣</div>
                      {mitPassed ? (
                        <>
                          <h3 style={{ color: 'var(--navy)', marginBottom: 8 }}>Eligible for Proclaimers</h3>
                          <p className="muted text-sm" style={{ maxWidth: 420, margin: '0 auto 16px' }}>
                            {fullName} has passed MIT and is eligible to register for Proclaimers!
                          </p>
                          <p className="text-sm muted">Share an active Proclaimers registration link with the student to complete enrolment.</p>
                        </>
                      ) : (
                        <>
                          <h3 style={{ color: 'var(--muted)', marginBottom: 8 }}>Proclaimers Enrolment Locked</h3>
                          <p className="muted text-sm" style={{ maxWidth: 420, margin: '0 auto' }}>
                            This student must pass MIT before registering for Proclaimers.
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

      {/* ── FULL PROFILE EDIT MODAL ── */}
      {fullEditOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '24px 16px', overflowY: 'auto',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setFullEditOpen(false); }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--navy)',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                  <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8, color: 'var(--gold)' }} />
                  Edit Full Profile
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  {fullName} · {student.student_unique_id}
                </div>
              </div>
              <button
                onClick={() => setFullEditOpen(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '0.88rem' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveFullProfile} style={{ padding: 28 }}>
              {profileMsg?.type === 'error' && (
                <div className="error-box" style={{ marginBottom: 20 }}>{profileMsg.text}</div>
              )}

              {/* Photo */}
              <div className="section-title" style={{ marginTop: 0 }}>Profile Photo</div>
              <PhotoUploader
                currentUrl={fullEditPhotoUrl}
                onPhotoSelected={(file) => setFullEditPhotoFile(file)}
                onUploaded={(url) => setFullEditPhotoUrl(url)}
                hint="JPG, JPEG, PNG, WebP · Max 5 MB · Photo will upload when you save."
              />

              {/* Personal Details */}
              <div className="section-title">Personal Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4 }}>
                {[
                  { key: 'surname', label: 'Surname', type: 'text' },
                  { key: 'first_name', label: 'First Name', type: 'text' },
                  { key: 'middle_name', label: 'Middle Name', type: 'text' },
                  { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
                ].map(({ key, label, type }) => (
                  <div key={key} className="field" style={{ marginBottom: 0 }}>
                    <label>{label}</label>
                    <input
                      type={type}
                      value={fullEditForm[key] || ''}
                      onChange={(e) => setFullEditForm((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Gender</label>
                <div className="radio-row">
                  {['Male', 'Female'].map((g) => (
                    <label key={g}>
                      <input type="radio" name="fe_gender" checked={fullEditForm.gender === g} onChange={() => setFullEditForm((p) => ({ ...p, gender: g }))} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>First Timer?</label>
                <div className="radio-row">
                  {['Yes', 'No'].map((v) => (
                    <label key={v}>
                      <input type="radio" name="fe_first_timer" checked={fullEditForm.is_first_timer === v} onChange={() => setFullEditForm((p) => ({ ...p, is_first_timer: v }))} />
                      {v === 'Yes' ? 'Yes — First Timer' : 'No — Regular Member'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="section-title">Contact Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { key: 'email', label: 'Email', type: 'email' },
                  { key: 'phone', label: 'Phone', type: 'text' },
                  { key: 'state_of_origin', label: 'State of Origin', type: 'text' },
                  { key: 'local_government', label: 'Local Government (LGA)', type: 'text' },
                  { key: 'nationality', label: 'Nationality', type: 'text' },
                ].map(({ key, label, type }) => (
                  <div key={key} className="field" style={{ marginBottom: 0 }}>
                    <label>{label}</label>
                    <input type={type} value={fullEditForm[key] || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Home Address</label>
                <textarea value={fullEditForm.home_address || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, home_address: e.target.value }))} style={{ minHeight: 60 }} />
              </div>

              {/* Next of Kin */}
              <div className="section-title">Next of Kin</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Next of Kin Name</label>
                  <input type="text" value={fullEditForm.next_of_kin || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, next_of_kin: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Relationship</label>
                  <input type="text" placeholder="e.g. Spouse, Parent, Sibling" value={fullEditForm.next_of_kin_relationship || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, next_of_kin_relationship: e.target.value }))} />
                </div>
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Next of Kin Phone Number</label>
                <input type="tel" value={fullEditForm.next_of_kin_phone || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, next_of_kin_phone: e.target.value }))} />
              </div>

              {/* Education */}
              <div className="section-title">Education &amp; Other</div>
              <div className="field">
                <label>Educational Background</label>
                <select value={fullEditForm.education || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, education: e.target.value }))}>
                  <option value="">Select…</option>
                  <option>Basic School Leaving Certificate</option>
                  <option>Secondary School Leaving Certificate</option>
                  <option>Tertiary Education Degree and above</option>
                </select>
              </div>
              <div className="field">
                <label>When did they join Citadel?</label>
                <input type="text" placeholder="e.g. January 2020" value={fullEditForm.church_join_date || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, church_join_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Challenges to participation</label>
                <textarea value={fullEditForm.challenges || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, challenges: e.target.value }))} style={{ minHeight: 50 }} />
              </div>

              {/* Spiritual */}
              <div className="section-title">Spiritual Background</div>
              <div className="field">
                <label>Born Again?</label>
                <div className="radio-row">
                  {['Yes', 'No', 'Maybe'].map((v) => (
                    <label key={v}>
                      <input type="radio" name="fe_born_again" checked={fullEditForm.born_again === v} onChange={() => setFullEditForm((p) => ({ ...p, born_again: v }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              {fullEditForm.born_again === 'Yes' && (
                <div className="field">
                  <label>If Yes, When and Where?</label>
                  <input type="text" value={fullEditForm.born_again_details || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, born_again_details: e.target.value }))} />
                </div>
              )}
              <div className="field">
                <label>Water Baptism (immersion)?</label>
                <div className="radio-row">
                  {['Yes', 'No'].map((v) => (
                    <label key={v}>
                      <input type="radio" name="fe_bap_water" checked={fullEditForm.baptized_water === v} onChange={() => setFullEditForm((p) => ({ ...p, baptized_water: v }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              {fullEditForm.baptized_water === 'Yes' && (
                <div className="field">
                  <label>If Yes, When and Where?</label>
                  <input type="text" value={fullEditForm.baptized_water_details || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, baptized_water_details: e.target.value }))} />
                </div>
              )}
              <div className="field">
                <label>Holy Spirit Baptism?</label>
                <div className="radio-row">
                  {['Yes', 'No'].map((v) => (
                    <label key={v}>
                      <input type="radio" name="fe_bap_hs" checked={fullEditForm.baptized_holy_spirit === v} onChange={() => setFullEditForm((p) => ({ ...p, baptized_holy_spirit: v }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              {fullEditForm.baptized_holy_spirit === 'Yes' && (
                <div className="field">
                  <label>If Yes, When and Where?</label>
                  <input type="text" value={fullEditForm.baptized_holy_spirit_details || ''} onChange={(e) => setFullEditForm((p) => ({ ...p, baptized_holy_spirit_details: e.target.value }))} />
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ flex: 1, padding: '13px' }}>
                  {savingProfile ? (
                    <><i className="fa-solid fa-spinner fa-spin" /> Saving…</>
                  ) : (
                    <><i className="fa-solid fa-floppy-disk" /> Save Full Profile</>
                  )}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setFullEditOpen(false)} style={{ padding: '13px 20px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
