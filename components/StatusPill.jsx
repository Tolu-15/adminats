export default function StatusPill({ status, fallback = 'Pending' }) {
  const s = (status || '').toString().trim().toUpperCase();
  if (!s) return <span className="grade-pill pending">{fallback}</span>;
  if (s === 'PASSED') return <span className="grade-pill passed">PASSED</span>;
  if (s === 'FAILED' || s === 'DROP') return <span className="grade-pill failed">DROP</span>;
  if (s === 'IN_PROGRESS') return <span className="grade-pill in-progress">IN PROGRESS</span>;
  return <span className="grade-pill pending">{fallback}</span>;
}
