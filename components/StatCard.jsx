export default function StatCard({ icon, label, value, sub, colorClass = 'gold' }) {
  const renderIcon = () => {
    if (typeof icon === 'string' && icon.startsWith('fa-')) {
      return <i className={`fa-solid ${icon}`}></i>;
    }
    return icon;
  };

  return (
    <div className="stat-card">
      <div className={`stat-card-icon ${colorClass}`}>{renderIcon()}</div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}
