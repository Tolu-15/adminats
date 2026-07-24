import Logo from './Logo';

export default function TopBar({ title = 'Membership', right = null }) {
  return (
    <div className="topbar">
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={72} style={{ borderRadius: '50%' }} />
        <span>{title}</span>
      </div>
      {right}
    </div>
  );
}

