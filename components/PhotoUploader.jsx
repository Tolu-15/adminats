export default function PhotoUploader({ preview, onChange }) {
  return (
    <div className="avatar-upload field">
      {preview
        ? <img src={preview} alt="Preview" className="avatar-preview" />
        : <div className="avatar-preview" />}
      <div>
        <input type="file" accept="image/*" onChange={onChange} />
        <div className="hint">Optional, but recommended for your profile.</div>
      </div>
    </div>
  );
}
