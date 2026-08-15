export default function CreateBatchForm({
  batchName, setBatchName,
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
        <div className="field" style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, color: 'var(--navy)' }}>Batch Name *</label>
          <input
            type="text"
            placeholder="e.g. Batch 056"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-plus"></i> Create Batch &amp; Generate Link
        </button>
      </form>
    </div>
  );
}
