export default function CreateBatchForm({
  batchName, setBatchName,
  onSubmit, error, saving = false,
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
          <label htmlFor="create-batch-name" style={{ fontWeight: 600, color: 'var(--navy)' }}>Batch Name *</label>
          <input
            id="create-batch-name"
            type="text"
            placeholder="e.g. Batch 056"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            disabled={saving}
            required
            autoFocus
          />
        </div>

        <button disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-plus"></i> {saving ? 'Creating batch...' : 'Create Batch & Generate Link'}
        </button>
      </form>
    </div>
  );
}
