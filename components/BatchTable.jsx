import Link from 'next/link';

export default function BatchTable({ batches, onCopyLink }) {
  if (batches.length === 0) {
    return <div className="card"><p className="muted">No batches yet. Create your first batch to get a registration link.</p></div>;
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Code</th>
            <th>Registrations</th>
            <th>Registration Link</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td><Link href={`/admin/batch/${b.id}`}>{b.batch_name}</Link></td>
              <td>{b.batch_code}</td>
              <td>{b.students?.[0]?.count ?? 0}</td>
              <td className="muted" style={{ fontSize: '0.82rem' }}>/register/{b.reg_token}</td>
              <td>
                <button className="btn btn-outline btn-sm" onClick={() => onCopyLink(b.reg_token)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-copy"></i> Copy Link
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
