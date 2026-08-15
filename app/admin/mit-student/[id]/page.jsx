'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import { useAdminGuard } from '../../../../lib/useAdminGuard';
import Sidebar from '../../../../components/Sidebar';
import MitGradeEditForm from '../../../../components/MitGradeEditForm';
import PageLoader from '../../../../components/PageLoader';
import { getImageUrl } from '../../../../lib/getImageUrl';

export default function MitStudentDetail() {
  const session = useAdminGuard();
  const { id } = useParams(); // mit_registrations.id
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(token) {
    const res = await fetch(`/api/mit/registrations/${id}/grades`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Failed to load.'); setLoading(false); return; }
    setData(json.registration);
    setLoading(false);
  }

  useEffect(() => { if (session) load(session.access_token); }, [session]);

  if (session === undefined || loading) return <PageLoader />;

  if (error) return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        <div className="admin-content">
          <div className="error-box">{error}</div>
        </div>
      </div>
    </div>
  );

  const s = data?.membership_student;
  const g = data?.mit_grades?.[0] ?? {};
  const batchId = data?.batch_id;
  const fullName = [s?.first_name, s?.middle_name, s?.surname].filter(Boolean).join(' ');

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href={`/admin/batch/${batchId}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>
              ← Back to Batch
            </Link>
            <div>
              <div className="admin-topbar-title">MIT Student Profile</div>
              <div className="muted text-sm">{fullName}</div>
            </div>
          </div>
          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── Left: Bio card ── */}
            <div className="card">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                {s?.photo_url ? (
                  <img src={getImageUrl(s.photo_url)} alt="Photo" style={{
                    width: 100, height: 100, borderRadius: '50%', objectFit: 'cover',
                    border: '3px solid var(--gold)', margin: '0 auto 12px',
                  }} />
                ) : (
                  <div style={{
                    width: 100, height: 100, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--gold), #b8960c)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', fontWeight: 700, color: '#fff', margin: '0 auto 12px',
                  }}>
                    {s?.first_name?.[0]}{s?.surname?.[0]}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--navy)' }}>{fullName}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(212,175,55,0.15)', color: 'var(--gold)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
                  }}>MIT</span>
                  {g.status && (
                    <span style={{
                      background: g.status === 'PASSED' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: g.status === 'PASSED' ? '#16a34a' : '#dc2626',
                      border: `1px solid ${g.status === 'PASSED' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
                    }}>{g.status}</span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                {[
                  ['Membership ID', s?.student_unique_id],
                  ['Card Number', s?.card_number || '—'],
                  ['Email', s?.email],
                  ['Phone', s?.phone],
                  ['Gender', s?.gender],
                  ['Date of Birth', s?.date_of_birth],
                  ['Church Join Date', s?.church_join_date],
                  ['State of Origin', s?.state_of_origin],
                  ['Education', s?.education],
                  ['MIT Department', data?.department || '—'],
                ].map(([label, value]) => value && (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 500, color: 'var(--navy)', wordBreak: 'break-word' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Membership grade summary */}
              <div style={{ marginTop: 16, background: 'var(--paper)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 8 }}>
                  Membership Grade
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{
                    background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 6, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700,
                  }}>✓ MEMBERSHIP PASSED</span>
                </div>
              </div>
            </div>

            {/* ── Right: Grade edit form ── */}
            <MitGradeEditForm
              registrationId={id}
              initialGrades={g}
              session={session}
              onSaved={() => load(session.access_token)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
