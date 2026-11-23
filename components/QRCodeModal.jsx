'use client';

import { useState, useEffect, useRef } from 'react';
import { copyToClipboard } from '../lib/copyToClipboard';

export default function QRCodeModal({ batch, baseUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [onClose]);

  if (!batch) return null;

  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const pType = (batch.programme_type || 'MEMBERSHIP').toUpperCase();

  let path = `/register/${batch.reg_token}`;
  if (pType === 'MIT') path = `/register-mit/${batch.reg_token}`;
  if (pType === 'PROCLAIMERS') path = `/register-proclaimers/${batch.reg_token}`;

  const fullUrl = `${origin}${path}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullUrl)}`;

  async function handleCopy() {
    if (busy) return;
    setBusy('copy'); setMessage(null);
    try {
      const success = await copyToClipboard(fullUrl);
      if (!success) throw new Error('Unable to copy automatically. Select and copy the registration link below.');
      setCopied(true); setMessage({ type: 'success', text: 'Registration link copied.' });
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to copy link.' }); }
    finally { setBusy(''); }
  }

  async function handleDownload() {
    if (busy) return;
    setBusy('download'); setMessage(null);
    try {
      const res = await fetch(qrApiUrl);
      if (!res.ok) throw new Error('Unable to download QR code. Please try again.');
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `QR_${batch.batch_code || 'Batch'}_Registration.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ type: 'success', text: 'QR code download started.' });
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to download QR code. Please try again.' }); }
    finally { setBusy(''); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(13, 27, 46, 0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="qr-title" className="card" style={{
        maxWidth: 420, width: '100%', padding: 28,
        textAlign: 'center', position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)', borderRadius: 16,
      }}>
        {/* Close Button */}
        <button
          ref={closeRef}
          type="button"
          aria-label="Close QR code"
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'none', border: 'none', fontSize: '0.8rem', padding: 6,
            cursor: 'pointer', color: 'var(--muted)',
          }}
        >
          Close
        </button>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <span className="badge badge-gold" style={{ fontSize: '0.75rem', marginBottom: 6, display: 'inline-block' }}>
            {pType} PROGRAMME
          </span>
          <h2 id="qr-title" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', margin: '4px 0 2px' }}>
            {batch.batch_name}
          </h2>
        </div>

        {/* QR Code Canvas Frame */}
        <div style={{
          background: '#FFFFFF', padding: 16, borderRadius: 16,
          border: '2px solid var(--border)', display: 'inline-block',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)', marginBottom: 16,
        }}>
          <img
            src={qrApiUrl}
            alt={`QR Code for ${batch.batch_name}`}
            style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }}
          />
        </div>

        {/* Scan instruction */}
        <p className="muted text-sm" style={{ marginBottom: 16, fontSize: '0.82rem' }}>
           Scan with any camera to display & open the registration link
        </p>

        {/* Registration Link Text box */}
        <div style={{
          background: 'var(--paper)', border: '1px solid var(--border)',
          padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem',
          wordBreak: 'break-all', color: 'var(--navy)', fontWeight: 600,
          marginBottom: 18, textAlign: 'left',
        }}>
          {fullUrl}
        </div>

        {message && <div className={message.type === 'error' ? 'error-box' : 'success-box'} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}
        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn btn-outline" onClick={handleDownload} disabled={!!busy} style={{ width: '100%', fontSize: '0.85rem' }}>
             {busy === 'download' ? 'Downloading...' : 'Save QR Code'}
          </button>
          <button className="btn btn-primary" onClick={handleCopy} disabled={!!busy} style={{ width: '100%', fontSize: '0.85rem' }}>
            {busy === 'copy' ? 'Copying...' : copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
