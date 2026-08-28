import Link from 'next/link';
import { getImageUrl } from '../lib/getImageUrl';

export default function MitStudentTable({ registrations = [], searchQuery = '', onNavigate }) {
  const q = searchQuery.toLowerCase().trim();

  const filtered = q
    ? registrations.filter((r) => {
        const s = r.membership_student || {};
        const fullName = `${s.first_name || ''} ${s.middle_name || ''} ${s.surname || ''}`.toLowerCase();
        return (
          fullName.includes(q) ||
          s.student_unique_id?.toLowerCase().includes(q) ||
          s.card_number?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q)
        );
      })
    : registrations;

  if (registrations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p className="muted">No MIT registrations yet for this batch.</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p className="muted">No MIT students match "<strong>{searchQuery}</strong>".</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Photo</th>
          <th>Student ID</th>
          <th>Card No</th>
          <th>Name</th>
          <th>Department</th>
          <th>Midterm</th>
          <th>Attendance</th>
          <th>CITH</th>
          <th>Final Exam</th>
          <th>Final Grade</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((reg) => {
          const s = reg.membership_student || {};
          const g = reg.mit_grades?.[0] || {};
          const status = (g.status || '').toString().trim().toUpperCase();
          const fullName = [s.surname, s.first_name, s.middle_name].filter(Boolean).join(' ');

          return (
            <tr key={reg.id}>
              <td>
                {s.photo_url ? (
                  <img src={getImageUrl(s.photo_url)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#E4C875,#B8862E)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                  }}>
                    {s.first_name?.[0]}{s.surname?.[0]}
                  </div>
                )}
              </td>
              <td><span className="badge badge-gold">{s.student_unique_id}</span></td>
              <td>
                {s.card_number ? (
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy)' }}>{s.card_number}</span>
                ) : (
                  <span className="muted text-sm">—</span>
                )}
              </td>
              <td>
                <Link href={`/admin/students/${s.id}`} onClick={onNavigate} style={{ fontWeight: 600, color: 'var(--navy)' }}>
                  {fullName}
                </Link>
              </td>
              <td className="muted text-sm">
                {g.department || reg.department || <span style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td>{g.midterm_test ?? '—'}</td>
              <td>{g.attendance ?? '—'}</td>
              <td>{g.cth ?? '—'}</td>
              <td>{g.final_exam ?? g.exam ?? '—'}</td>
              <td><strong>{g.final_grades ?? '—'}</strong></td>
              <td>
                {status === 'PASSED' ? (
                  <span className="grade-pill passed">PASSED</span>
                ) : status === 'FAILED' || status === 'DROP' ? (
                  <span className="grade-pill failed">DROP</span>
                ) : status === 'IN_PROGRESS' ? (
                  <span className="grade-pill in-progress">IN PROGRESS</span>
                ) : (
                  <span className="grade-pill pending">Pending</span>
                )}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Link href={`/admin/mit-student/${reg.id}`} onClick={onNavigate} className="btn btn-primary btn-sm">
                    View &amp; Edit Grades
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
