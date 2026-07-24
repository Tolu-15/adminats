'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { useAdminGuard } from '../../../../lib/useAdminGuard';
import Sidebar from '../../../../components/Sidebar';
import StudentTable from '../../../../components/StudentTable';
import MitStudentTable from '../../../../components/MitStudentTable';

const PROG_STYLES = {
  MEMBERSHIP:   { label: 'Membership', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  MIT:          { label: 'MIT', color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  PROCLAIMERS:  { label: 'Proclaimers', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
};

export default function BatchDetail() {
  const session = useAdminGuard();
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);       // MEMBERSHIP
  const [mitRegs, setMitRegs] = useState([]);          // MIT
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    async function load() {
      const { data: b } = await supabase.from('batches').select('*').eq('id', id).single();
      setBatch(b);

      if (b?.programme_type === 'MIT') {
        const { data: regs } = await supabase
          .from('mit_registrations')
          .select(`
            id, department, created_at,
            membership_student:students(id, surname, first_name, middle_name, student_unique_id, card_number, photo_url),
            mit_grades(status, final_grades, department)
          `)
          .eq('batch_id', id)
          .order('created_at', { ascending: false });
        setMitRegs(regs || []);
      } else {
        const { data: s } = await supabase
          .from('students')
          .select('*, student_grades(*)')
          .eq('batch_id', id)
          .order('created_at', { ascending: false });
        setStudents(s || []);
      }
      setLoading(false);
    }
    load();
  }, [session, id]);

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

  async function downloadExcel() {
    const res = await fetch(`/api/batches/${id}/export`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { alert('Export failed.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="(.+?)"/);
    a.download = match ? match[1] : `Batch_${batch?.batch_code}_Grades.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/batches/${id}/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: fd,
    });
    const json = await res.json();
    setImportResult(json);
    setImporting(false);

    // Reload list
    if (batch?.programme_type === 'MIT') {
      const { data: regs } = await supabase
        .from('mit_registrations')
        .select(`
          id, department, created_at,
          membership_student:students(id, surname, first_name, middle_name, student_unique_id, card_number, photo_url),
          mit_grades(status, final_grades, department)
        `)
        .eq('batch_id', id)
        .order('created_at', { ascending: false });
      setMitRegs(regs || []);
    } else {
      const { data: s } = await supabase
        .from('students')
        .select('*, student_grades(*)')
        .eq('batch_id', id)
        .order('created_at', { ascending: false });
      setStudents(s || []);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (session === undefined || loading) {
    return (
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  const prog = PROG_STYLES[batch?.programme_type] || PROG_STYLES.MEMBERSHIP;
  const isMIT = batch?.programme_type === 'MIT';
  const count = isMIT ? mitRegs.length : students.length;

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>
              ← Back
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="admin-topbar-title">{batch?.batch_name}</div>
                <span style={{
                  background: prog.bg, color: prog.color,
                  border: `1px solid ${prog.color}44`,
                  borderRadius: 5, padding: '2px 8px',
                  fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.5,
                }}>{prog.label}</span>
              </div>
              <div className="muted text-sm">Batch #{batch?.batch_code} · {count} {isMIT ? 'MIT student' : 'student'}{count !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="admin-topbar-right">
            <span className="muted text-sm">{session?.user?.email}</span>
          </div>
        </div>

        <div className="admin-content">
          {/* Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="search-wrap" style={{ maxWidth: 320 }}>
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or student ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={downloadTemplate} title="Download master migration template Excel sheet">
                <i className="fa-solid fa-file-excel"></i> Migration Template
              </button>
              <button className="btn btn-outline btn-sm" onClick={downloadExcel}>
                <i className="fa-solid fa-file-export"></i> Export Grade Sheet
              </button>
              <label className="btn btn-gold btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {importing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Migrating…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-import"></i> Batch Data Upload
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                  disabled={importing}
                />
              </label>
            </div>
          </div>

          {/* Import result feedback */}
          {importResult && (
            <div className={(importResult.studentsProcessed > 0 || importResult.gradesUpdated > 0 || importResult.updated > 0) ? 'success-box' : 'info-box'} style={{ marginBottom: 16 }}>
              <strong>{importResult.message || `Processed ${importResult.updated || 0} record(s).`}</strong>
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {isMIT
              ? <MitStudentTable registrations={mitRegs} searchQuery={search} />
              : <StudentTable students={students} searchQuery={search} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}
