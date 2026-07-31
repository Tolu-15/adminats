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

        <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-plus"></i> Create Batch &amp; Generate Link
        </button>
      </form>
    </div>
  );
}
