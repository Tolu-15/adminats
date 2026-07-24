import Link from 'next/link';

export default function MitStudentTable({ registrations = [], searchQuery = '' }) {
  const q = searchQuery.toLowerCase().trim();

  const filtered = q
    ? registrations.filter((r) => {
        const s = r.membership_student;
        const fullName = `${s.first_name} ${s.middle_name ?? ''} ${s.surname}`.toLowerCase();
        return (
          fullName.includes(q) ||
          s.student_unique_id?.toLowerCase().includes(q) ||
          s.card_number?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q)
        );
      })
    : registrations;

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
        <p style={{ color: 'var(--muted)' }}>
          {q ? `No MIT students match "${searchQuery}".` : 'No MIT registrations yet.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--paper)' }}>
            <th style={th}>#</th>
            <th style={th}>Student</th>
            <th style={th}>Membership ID</th>
            <th style={th}>Card No.</th>
            <th style={th}>Department</th>
            <th style={th}>Final Grades</th>
            <th style={th}>Status</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((reg, idx) => {
            const s = reg.membership_student;
            const g = reg.mit_grades?.[0] ?? {};
            const status = g.status?.toUpperCase();
            return (
              <tr key={reg.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={td}>{idx + 1}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.photo_url ? (
                      <img src={s.photo_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', background: 'var(--gold)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {s.first_name?.[0]}{s.surname?.[0]}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {s.first_name} {s.middle_name ? s.middle_name + ' ' : ''}{s.surname}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {s.student_unique_id}
                </td>
                <td style={{ ...td, fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {s.card_number || <span style={{ opacity: 0.4 }}>—</span>}
                </td>
                <td style={td}>
                  {g.department || reg.department || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>}
                </td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>
                  {g.final_grades != null ? g.final_grades : <span style={{ color: 'var(--muted)', opacity: 0.4 }}>—</span>}
                </td>
                <td style={td}>
                  {status ? (
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                      background: status === 'PASSED' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: status === 'PASSED' ? '#16a34a' : '#dc2626',
                      border: `1px solid ${status === 'PASSED' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                      {status}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem', opacity: 0.6 }}>Pending</span>
                  )}
                </td>
                <td style={td}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    View Profile
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem',
  fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5,
};
const td = { padding: '12px 16px', verticalAlign: 'middle' };
