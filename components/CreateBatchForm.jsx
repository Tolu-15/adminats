export default function CreateBatchForm({
  batchCode, setBatchCode,
  batchName, setBatchName,
  programmeType, setProgrammeType,
  onSubmit, error,
}) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {error && (
        <div className="error-box" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Batch Code</label>
            <input type="text" placeholder="e.g. 056" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Batch Name</label>
            <input type="text" placeholder="e.g. Batch 056" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Programme Type</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: 'MEMBERSHIP', icon: 'fa-graduation-cap', label: 'Membership', color: '#3b82f6' },
              { value: 'MIT', icon: 'fa-book-open', label: 'MIT', color: 'var(--gold)' },
              { value: 'PROCLAIMERS', icon: 'fa-bullhorn', label: 'Proclaimers', color: '#8b5cf6' },
            ].map(({ value, icon, label, color }) => {
              const isSelected = (programmeType || 'MEMBERSHIP') === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProgrammeType(value)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, border: `2px solid ${isSelected ? color : 'var(--border)'}`,
                    background: isSelected ? `${color}22` : 'transparent',
                    color: isSelected ? color : 'var(--muted)',
                    fontWeight: isSelected ? 700 : 400,
                    cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <i className={`fa-solid ${icon}`}></i>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-plus"></i> Create Batch &amp; Generate Link
        </button>
      </form>
    </div>
  );
}
