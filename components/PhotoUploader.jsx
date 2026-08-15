'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { getImageUrl } from '../lib/getImageUrl';
import { compressPassportPhoto } from '../lib/compressImage';

/**
 * PhotoUploader
 * Props:
 *   currentUrl        – existing photo URL (for edit mode)
 *   onPhotoSelected   – callback(compressedFile: File | null) called when image is selected & compressed
 *   onUploaded        – callback(publicUrl: string) optional immediate upload callback
 *   label             – optional label override
 *   hint              – optional hint text override
 */
export default function PhotoUploader({ currentUrl, onPhotoSelected, onUploaded, label, hint }) {
  const [preview, setPreview] = useState(getImageUrl(currentUrl) || null);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (currentUrl) {
      setPreview(getImageUrl(currentUrl));
    }
  }, [currentUrl]);

  async function handleSelectFile(rawFile) {
    if (!rawFile) return;

    setError('');
    setProcessing(true);
    setCompressionInfo(null);

    try {
      // Step 1: Validate and Compress passport photo client-side
      const result = await compressPassportPhoto(rawFile);
      setPreview(result.previewUrl);
      setCompressionInfo({
        sizeKb: result.sizeKb,
        originalSizeKb: result.originalSizeKb,
        width: result.width,
        height: result.height,
      });

      // Pass compressed file to parent form handler (upload occurs when submit is clicked)
      onPhotoSelected?.(result.file);

      // If immediate upload is requested
      if (onUploaded && !onPhotoSelected) {
        const fd = new FormData();
        fd.append('file', result.file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed.');
        onUploaded(json.publicUrl);
      }
    } catch (err) {
      console.error('[PhotoUploader error]', err);
      setError(err.message || 'Failed to process image.');
      onPhotoSelected?.(null);
    } finally {
      setProcessing(false);
    }
  }

  function handleFileInput(e) {
    handleSelectFile(e.target.files?.[0]);
    e.target.value = '';
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleSelectFile(e.dataTransfer.files?.[0]);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: '0.84rem', fontWeight: 600,
        marginBottom: 10, color: 'var(--navy)',
      }}>
        {label || 'Passport Photo'}
      </div>

      <div
        onClick={() => !processing && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '16px 20px',
          border: `2px dashed ${dragOver ? 'var(--gold)' : error ? 'var(--danger)' : 'var(--line)'}`,
          borderRadius: 12,
          background: dragOver ? 'rgba(212,175,55,0.05)' : 'var(--paper)',
          cursor: processing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {/* Passport Preview (4:5 ratio avatar) */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {preview ? (
            <img
              src={preview}
              alt="Passport Preview"
              style={{
                width: 72, height: 90, borderRadius: 8, objectFit: 'cover',
                border: '2px solid var(--gold)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              }}
            />
          ) : (
            <div style={{
              width: 72, height: 90, borderRadius: 8,
              background: 'linear-gradient(135deg, #E4C875, #B8862E)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#fff', gap: 4,
            }}>
              <i className="fa-solid fa-user" style={{ fontSize: '1.6rem' }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Passport</span>
            </div>
          )}

          {/* Processing spinner */}
          {processing && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 8,
              background: 'rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--navy)', fontSize: '1.4rem' }} />
            </div>
          )}
        </div>

        {/* Text, Metadata & Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {processing ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>
                Compressing passport photo…
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                Optimizing to ~400×500px (&lt;100 KB)
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>
                {preview ? 'Change Passport Photo' : 'Select Passport Photo'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>
                {hint || 'JPG, JPEG, PNG, WebP · Max 5 MB · Photo uploads automatically when you click submit.'}
              </div>

              {/* Compressed Image Metadata Badge */}
              {compressionInfo && !error && (
                <div style={{
                  marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(22,163,74,0.1)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)',
                  borderRadius: 6, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600,
                }}>
                  <i className="fa-solid fa-compress" />
                  Ready: {compressionInfo.sizeKb} KB ({compressionInfo.width}×{compressionInfo.height}px)
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>from {compressionInfo.originalSizeKb} KB</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 6, fontSize: '0.78rem', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500,
            }}>
              <i className="fa-solid fa-circle-exclamation" />
              {error}
            </div>
          )}
        </div>

        {/* Success Indicator */}
        {preview && !processing && !error && (
          <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '1.3rem', flexShrink: 0 }} />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileInput}
        disabled={processing}
      />
    </div>
  );
}
