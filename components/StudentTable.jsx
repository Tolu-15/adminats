import Link from 'next/link';
import { getImageUrl } from '../lib/getImageUrl';

export default function StudentTable({ students, searchQuery = '', onNavigate }) {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? students.filter(
        (s) =>
          `${s.surname} ${s.first_name} ${s.middle_name || ''}`.toLowerCase().includes(q) ||
          (s.student_unique_id || '').toLowerCase().includes(q) ||
          (s.card_number || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
      )
    : students;

  if (students.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p className="muted">No registrations yet for this batch.</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p className="muted">No students match "<strong>{searchQuery}</strong>".</p>
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
          <th>Attendance</th>
          <th>Test</th>
          <th>Exam</th>
          <th>Final Grade</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((s) => {
          const g = s.membership_grades?.[0] || {};
          const status = (g.status || '').toString().trim().toUpperCase();
          const fullName = [s.surname, s.first_name, s.middle_name].filter(Boolean).join(' ');

          return (
            <tr key={s.id}>
              <td>
                {s.photo_url ? (
                  <img src={getImageUrl(s.photo_url)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#E4C875,#B8862E)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '0.75rem'
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
              <td>{g.attendance ?? '—'}</td>
              <td>{g.test ?? '—'}</td>
              <td>{g.exam ?? '—'}</td>
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
                  <Link href={`/admin/students/${s.id}`} onClick={onNavigate} className="btn btn-primary btn-sm">
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
