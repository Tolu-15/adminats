'use client';

import { copyToClipboard } from '../../lib/copyToClipboard';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useAdminGuard } from '../../lib/useAdminGuard';
import Sidebar from '../../components/Sidebar';
import StatCard from '../../components/StatCard';
import CreateBatchForm from '../../components/CreateBatchForm';

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

  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (envUrl) {
      setBaseUrl(envUrl.replace(/\/$/, ''));
    } else {
      setBaseUrl(window.location.origin);
    }
  }, []);

  async function loadData(token) {
    setLoading(true);
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

  useEffect(() => { if (session) loadData(session.access_token); }, [session]);

  // Reset page to 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [progFilter, batchSearch]);

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
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ batch_code: batchCode, batch_name: batchName, programme_type: programmeType }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setBatchCode(''); setBatchName(''); setProgrammeType('MEMBERSHIP'); setShowForm(false);
    loadData(session.access_token);
  }

  function getRegPath(batch) {
    if (batch.programme_type === 'PROCLAIMERS') return `/register-proclaimers/${batch.reg_token}`;
    if (batch.programme_type === 'MIT') return `/register-mit/${batch.reg_token}`;
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
    const res = await fetch('/api/admin/template', {
      headers: { Authorization: `Bearer ${session.access_token}` },
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

  if (session === undefined) {
    return (
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, background: 'var(--paper)' }}>
          <p className="muted">Checking session…</p>
        </div>
      </div>
    );
  }

  // Filter batches by programme and search query
  const batchesList = Array.isArray(batches) ? batches : [];
  const filteredBatches = batchesList.filter((b) => {
    if (progFilter !== 'ALL' && b.programme_type !== progFilter) return false;
    if (batchSearch.trim()) {
      const q = batchSearch.trim().toLowerCase();
      const codeMatch = (b.batch_code || '').toLowerCase().includes(q);
      const nameMatch = (b.batch_name || '').toLowerCase().includes(q);
      const typeMatch = (b.programme_type || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || typeMatch;
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

          {/* Stats Grid */}
          {stats && (
            <div className="stats-grid">
              <StatCard icon="fa-users" label="Total Students" value={stats.totalStudents} sub="Across all batches" colorClass="blue" />
              <StatCard icon="fa-layer-group" label="Total Batches" value={stats.totalBatches} colorClass="gold" />
              <StatCard icon="fa-circle-check" label="Active Batches" value={stats.activeBatches} colorClass="green" />
              <StatCard
                icon="fa-clock"
                label="Latest Registration"
                value={stats.recentStudent ? `${stats.recentStudent.first_name} ${stats.recentStudent.surname}` : '—'}
                sub={stats.recentStudent ? new Date(stats.recentStudent.created_at).toLocaleDateString() : 'No registrations yet'}
                colorClass="purple"
              />
            </div>
          )}

          {/* ── BATCH SECTION CONTROLS ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0 }}>Programme Batches</h2>
              <p className="muted text-sm" style={{ marginTop: 2 }}>Filter by programme type or search batches</p>
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

          {/* ── FILTER & SEARCH TOOLBAR ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, marginBottom: 20, flexWrap: 'wrap', background: '#fff',
            padding: 12, borderRadius: 12, border: '1px solid var(--border)'
          }}>
            {/* Programme Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', icon: 'fa-border-all', label: 'All Programmes' },
                { id: 'MEMBERSHIP', icon: 'fa-graduation-cap', label: 'Membership' },
                { id: 'MIT', icon: 'fa-book-open', label: 'MIT' },
                { id: 'PROCLAIMERS', icon: 'fa-bullhorn', label: 'Proclaimers' },
              ].map((tab) => {
                const isSelected = progFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setProgFilter(tab.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(212,175,55,0.12)' : 'transparent',
                      color: isSelected ? 'var(--navy)' : 'var(--muted)', cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <i className={`fa-solid ${tab.icon}`}></i>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

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
                {batchSearch || progFilter !== 'ALL'
                  ? 'No batches match your filter or search criteria.'
                  : 'No batches yet. Create your first batch to get started.'}
              </p>
            </div>
          ) : (
            <>
              <div className="batch-grid">
                {paginatedBatches.map((b) => {
                  const prog = PROG_STYLES[b.programme_type] || PROG_STYLES.MEMBERSHIP;
                  const regPath = getRegPath(b);
                  const count = b.programme_type === 'PROCLAIMERS'
                    ? (b.proclaimers_registrations?.[0]?.count ?? 0)
                    : b.programme_type === 'MIT'
                    ? (b.mit_registrations?.[0]?.count ?? 0)
                    : (b.students?.[0]?.count ?? 0);

                  return (
                    <div key={b.id} className="batch-card">
                      <div className="batch-card-header">
                        <a href={`/admin/batch/${b.id}`} className="batch-card-name" style={{ textDecoration: 'none' }}>
                          {b.batch_name}
                        </a>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            background: prog.bg, color: prog.color,
                            border: `1px solid ${prog.color}44`,
                            borderRadius: 5, padding: '2px 8px',
                            fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.5,
                          }}>{prog.label}</span>
                          <span className="batch-card-code">#{b.batch_code}</span>
                        </div>
                      </div>
                      <div className="batch-card-count">
                        <strong>{count}</strong> student{count !== 1 ? 's' : ''} registered
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                        {regPath}
                      </div>
                      <div className="batch-card-actions">
                        <a href={`/admin/batch/${b.id}`} className="btn btn-primary btn-sm">View Batch</a>
                        <button className="btn btn-outline btn-sm" onClick={() => copyLink(b)}>
                          {copied === b.id ? (
                            <>
                              <i className="fa-solid fa-check"></i> Copied!
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-copy"></i> Copy Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

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
