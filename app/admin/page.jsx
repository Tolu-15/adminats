'use client';

import { copyToClipboard } from '../../lib/copyToClipboard';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useAdminGuard } from '../../lib/useAdminGuard';
import Sidebar from '../../components/Sidebar';
import StatCard from '../../components/StatCard';
import CreateBatchForm from '../../components/CreateBatchForm';
import QRCodeModal from '../../components/QRCodeModal';
import { CleanGrowthGraph, CleanDemographicsGraph } from '../../components/AnalyticsCharts';

const PROG_STYLES = {
  MEMBERSHIP:   { label: 'MEMBERSHIP', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  MIT:          { label: 'MIT',        color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  PROCLAIMERS:  { label: 'PROCLAIMERS',color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
};

export default function AdminDashboard() {
  const session = useAdminGuard();

  const [batches, setBatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeQrBatch, setActiveQrBatch] = useState(null);

  // Batch Filter, Search & Pagination
  const [progFilter, setProgFilter] = useState('ALL'); // 'ALL' | 'MEMBERSHIP' | 'MIT' | 'PROCLAIMERS'
  const [batchSearch, setBatchSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Global Student Search
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Create Batch Form state
  const [showForm, setShowForm] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [batchName, setBatchName] = useState('');
  const [programmeType, setProgrammeType] = useState('MEMBERSHIP');
  const [error, setError] = useState('');

  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(null);
  const [deletingBatch, setDeletingBatch] = useState(null); // id of batch being deleted

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setBaseUrl(window.location.origin);
    } else if (process.env.NEXT_PUBLIC_BASE_URL) {
      setBaseUrl(process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, ''));
    }
  }, []);

  async function loadData(customToken) {
    setLoading(true);
    const { data: freshData } = await supabase.auth.getSession();
    const token = customToken || freshData?.session?.access_token || session?.access_token;
    if (!token) { setLoading(false); return; }

    const [batchRes, statsRes] = await Promise.all([
      fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const batchJson = await batchRes.json();
    const statsJson = await statsRes.json();
    if (batchRes.ok) setBatches(batchJson.batches || []);
    if (statsRes.ok) setStats(statsJson);
    setLoading(false);
  }

  useEffect(() => { if (session) loadData(session?.access_token); }, [session]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [batchSearch]);

  // Global Student Search logic
  useEffect(() => {
    const q = studentSearch.trim();
    if (!q) { setSearchResults([]); return; }

    const timer = setTimeout(async () => {
      setSearchingStudents(true);
      const { data } = await supabase
        .from('students')
        .select('id, surname, first_name, student_unique_id, card_number, photo_url')
        .or(`surname.ilike.%${q}%,first_name.ilike.%${q}%,student_unique_id.ilike.%${q}%,card_number.ilike.%${q}%`)
        .limit(6);
      setSearchResults(data || []);
      setSearchingStudents(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [studentSearch]);

  async function createBatch(e) {
    e.preventDefault();
    setError('');
    if (!batchCode || !batchName) { setError('Enter both a batch code and a batch name.'); return; }

    const { data: freshData } = await supabase.auth.getSession();
    const token = freshData?.session?.access_token || session?.access_token;

    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch_code: batchCode, batch_name: batchName, programme_type: programmeType }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Failed to create batch.'); return; }
    setBatchCode(''); setBatchName(''); setProgrammeType('MEMBERSHIP'); setShowForm(false);
    loadData(token);
  }

  function getRegPath(batch) {
    return `/register/${batch.reg_token}`;
  }

  async function copyLink(batch) {
    const fullUrl = `${baseUrl}${getRegPath(batch)}`;
    const success = await copyToClipboard(fullUrl);
    if (success) {
      setCopied(batch.id);
      setTimeout(() => setCopied(null), 2000);
    } else {
      alert(`Link: ${fullUrl}`);
    }
  }

  async function downloadTemplate() {
    const { data: freshData } = await supabase.auth.getSession();
    const token = freshData?.session?.access_token || session?.access_token;

    const res = await fetch('/api/admin/template', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { alert('Template download failed.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ATS_Master_Migration_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteBatch(batch) {
    if (!confirm(`Delete "${batch.batch_name}"? This cannot be undone.`)) return;
    setDeletingBatch(batch.id);

    const { data: freshData } = await supabase.auth.getSession();
    const token = freshData?.session?.access_token || session?.access_token;

    const res = await fetch(`/api/batches/${batch.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeletingBatch(null);
    if (res.ok) {
      loadData(token);
    } else {
      const json = await res.json();
      alert(`Delete failed: ${json.error}`);
    }
  }

  if (session === undefined) {
    return (
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, background: 'var(--paper)' }}>
          <p className="muted">Checking session…</p>
        </div>
      </div>
    );
  }

  // Filter batches by search query
  const batchesList = Array.isArray(batches) ? batches : [];
  const filteredBatches = batchesList.filter((b) => {
    if (batchSearch.trim()) {
      const q = batchSearch.trim().toLowerCase();
      const codeMatch = (b.batch_code || '').toLowerCase().includes(q);
      const nameMatch = (b.batch_name || '').toLowerCase().includes(q);
      return codeMatch || nameMatch;
    }
    return true;
  });

  // Pagination calculation (3 items per page)
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage) || 1;
  const paginatedBatches = filteredBatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">

        {/* Top bar with Global Student Search */}
        <div className="admin-topbar">
          <div style={{ flex: 1, maxWidth: 460, position: 'relative' }}>
            <div className="search-wrap">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search any student by name, student ID, card no…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>

            {/* Global Search Results Dropdown */}
            {studentSearch.trim() !== '' && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
                background: '#fff', border: '1.5px solid var(--border)', borderRadius: 10,
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden'
              }}>
                {searchingStudents ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>Searching students…</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>No student found matching "{studentSearch}"</div>
                ) : (
                  <div>
                    {searchResults.map((s) => (
                      <Link
                        key={s.id}
                        href={`/admin/students/${s.id}`}
                        onClick={() => setStudentSearch('')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          textDecoration: 'none', borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'var(--gold)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0
                        }}>
                          {s.first_name?.[0]}{s.surname?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{s.surname} {s.first_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            ID: {s.student_unique_id} {s.card_number ? `· Card: ${s.card_number}` : ''}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">

          {/* ── GRAPH ANALYTICS DASHBOARD ── */}
          {stats && (
            <div style={{ marginBottom: 28 }}>
              {/* 4 Premium Stat Cards */}
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <StatCard
                  icon="fa-users"
                  label="Total Enrolled"
                  value={stats.totalStudents}
                  sub={`Mem: ${stats.membershipTotal} · MIT: ${stats.mitTotal} · Proc: ${stats.proclaimersTotal}`}
                  colorClass="blue"
                />
                <StatCard
                  icon="fa-venus-mars"
                  label="Gender Ratio"
                  value={`${stats.malePercent}% M / ${stats.femalePercent}% F`}
                  sub={`Male: ${stats.maleCount} · Female: ${stats.femaleCount}`}
                  colorClass="purple"
                />
                <StatCard
                  icon="fa-star"
                  label="First Timers"
                  value={stats.firstTimerCount}
                  sub={`${stats.firstTimerPercent}% of Membership Enrolment`}
                  colorClass="gold"
                />
                <StatCard
                  icon="fa-layer-group"
                  label="Batches Overview"
                  value={`${stats.activeBatches} Active`}
                  sub={`${stats.totalBatches} Total Batches Registered`}
                  colorClass="green"
                />
              </div>

              {/* Clean Multi-Color Analytics Trend Graphs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
                
                {/* Left Panel: Clean Batch Growth Trend Lines */}
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                      📈 Batch Student Growth
                    </h3>
                    <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Trends</span>
                  </div>

                  <CleanGrowthGraph data={stats.batchDistribution || []} />
                </div>

                {/* Right Panel: Clean Demographics & First Timers */}
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                      📊 Student Demographics
                    </h3>
                    <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Membership Demographics</span>
                  </div>

                  <CleanDemographicsGraph
                    maleCount={stats.maleCount}
                    femaleCount={stats.femaleCount}
                    firstTimerCount={stats.firstTimerCount}
                    membershipTotal={stats.membershipTotal}
                  />
                </div>

              </div>
            </div>
          )}

          {/* ── BATCH SECTION CONTROLS ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0 }}>Batches</h2>
              <p className="muted text-sm" style={{ marginTop: 2 }}>Search and manage all batches</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={downloadTemplate} title="Download master migration template Excel sheet">
                <i className="fa-solid fa-file-excel"></i> Migration Template
              </button>
              <button className="btn btn-gold" onClick={() => setShowForm((s) => !s)}>
                {showForm ? (
                  <>
                    <i className="fa-solid fa-xmark"></i> Cancel
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i> New Batch
                  </>
                )}
              </button>
            </div>
          </div>

          {showForm && (
            <div style={{ marginBottom: 24 }}>
              <CreateBatchForm
                batchCode={batchCode} setBatchCode={setBatchCode}
                batchName={batchName} setBatchName={setBatchName}
                programmeType={programmeType} setProgrammeType={setProgrammeType}
                onSubmit={createBatch} error={error}
              />
            </div>
          )}

          {/* ── SEARCH TOOLBAR ── */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            gap: 12, marginBottom: 20, flexWrap: 'wrap', background: '#fff',
            padding: 12, borderRadius: 12, border: '1px solid var(--border)'
          }}>
            {/* Batch Search Input */}
            <div className="search-wrap" style={{ maxWidth: 280 }}>
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search batches e.g. Batch 056..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── BATCH GRID ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <p className="muted">Loading batches…</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12, color: 'var(--muted)' }}>
                <i className="fa-solid fa-folder-open"></i>
              </div>
              <p className="muted">
                {batchSearch
                  ? 'No batches match your search.'
                  : 'No batches yet. Create your first batch to get started.'}
              </p>
            </div>
          ) : (
            <>
              <div className="batch-grid">
                {paginatedBatches.map((b) => {
                  const regPath = getRegPath(b);
                  const count =
                    (b.students?.[0]?.count ?? 0) +
                    (b.mit_registrations?.[0]?.count ?? 0) +
                    (b.proclaimers_registrations?.[0]?.count ?? 0);

                  return (
                    <div key={b.id} className="batch-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Card Header: Batch Name, Code Badge & Delete Icon */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div>
                          <a href={`/admin/batch/${b.id}`} className="batch-card-name" style={{ textDecoration: 'none', fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)' }}>
                            {b.batch_name}
                          </a>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span className="batch-card-code">#{b.batch_code}</span>
                            {b.programme_type && (
                              <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                {b.programme_type}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top-Right Delete Button */}
                        <button
                          onClick={() => deleteBatch(b)}
                          disabled={deletingBatch === b.id}
                          title="Delete batch"
                          style={{
                            background: '#fee2e2', color: '#dc2626',
                            border: '1px solid #fca5a5', borderRadius: 8,
                            width: 32, height: 32, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            cursor: deletingBatch === b.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', flexShrink: 0,
                          }}
                        >
                          {deletingBatch === b.id ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-trash" />}
                        </button>
                      </div>

                      {/* Student Count & Path Container */}
                      <div style={{ background: 'var(--paper)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div className="batch-card-count" style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                          <strong style={{ color: 'var(--navy)', fontSize: '0.98rem' }}>{count}</strong> student{count !== 1 ? 's' : ''} registered
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                          {regPath}
                        </div>
                      </div>

                      {/* Action Buttons Row */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                        <a href={`/admin/batch/${b.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, minWidth: 95, textAlign: 'center', justifyContent: 'center' }}>
                          View Batch
                        </a>
                        <button className="btn btn-outline btn-sm" onClick={() => setActiveQrBatch(b)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i className="fa-solid fa-qrcode"></i> QR Code
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => copyLink(b)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {copied === b.id ? (
                            <><i className="fa-solid fa-check"></i> Copied!</>
                          ) : (
                            <><i className="fa-solid fa-copy"></i> Copy Link</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* QR Code Modal */}
              {activeQrBatch && (
                <QRCodeModal
                  batch={activeQrBatch}
                  baseUrl={baseUrl}
                  onClose={() => setActiveQrBatch(null)}
                />
              )}

              {/* ── PAGINATION CONTROLS (3 items per page) ── */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'between',
                  marginTop: 24, background: '#fff', padding: '12px 18px',
                  borderRadius: 12, border: '1px solid var(--line)', gap: 12
                }}>
                  <div className="text-sm muted">
                    Showing <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> – <strong>{Math.min(currentPage * itemsPerPage, filteredBatches.length)}</strong> of <strong>{filteredBatches.length}</strong> batches
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    >
                      <i className="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)', padding: '0 8px' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    >
                      Next <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
