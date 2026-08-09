'use client';

import { useEffect } from 'react';

export default function Toast({ message, type = 'error', onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 20px',
      borderRadius: 12,
      background: type === 'error' ? '#FEF2F2' : '#ECFDF5',
      color: type === 'error' ? '#991B1B' : '#065F46',
      border: `1.5px solid ${type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
      width: 'calc(100% - 32px)',
      maxWidth: 460,
      fontSize: '0.92rem',
      fontWeight: 600,
      animation: 'toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <style jsx global>{`
        @keyframes toastSlideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
      <i className={type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check'} style={{ fontSize: '1.25rem', flexShrink: 0 }} />
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
        }}
        aria-label="Close notification"
      >
        <i className="fa-solid fa-xmark" style={{ fontSize: '1.1rem' }} />
      </button>
    </div>
  );
}
