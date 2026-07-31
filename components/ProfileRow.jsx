export default function ProfileRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="muted" style={{ fontSize: '0.85rem', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '70%', wordBreak: 'break-all', overflowWrap: 'anywhere', color: 'var(--navy)', fontSize: '0.88rem' }}>
        {value || '—'}
      </span>
    </div>
  );
}
