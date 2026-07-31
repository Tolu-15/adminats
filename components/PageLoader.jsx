'use client';

import { useEffect, useState } from 'react';

const TAGLINES = [
  'Preparing your workspace…',
  'Fetching student records…',
  'Loading grade data…',
  'Almost there…',
];

export default function PageLoader({ message = 'Loading…' }) {
  const [progress, setProgress] = useState(0);
  const [tagline, setTagline] = useState(TAGLINES[0]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Smooth progress bar — hits 85% in ~1s, then stalls waiting for real data
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 8 + 3;
      if (p > 85) { p = 85; clearInterval(interval); }
      setProgress(Math.round(p));
    }, 120);

    // Rotate taglines
    let idx = 0;
    const tagTimer = setInterval(() => {
      idx = (idx + 1) % TAGLINES.length;
      setTagline(TAGLINES[idx]);
    }, 900);

    return () => {
      clearInterval(interval);
      clearInterval(tagTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: `linear-gradient(135deg, rgba(10, 22, 40, 0.88) 0%, rgba(13, 27, 46, 0.92) 100%), url('/bg.png') center/cover no-repeat`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%', top: '-120px', left: '-100px',
        background: 'radial-gradient(circle, rgba(196,154,46,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', bottom: '-80px', right: '-80px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo mark */}
      <div style={{ position: 'relative', marginBottom: 36 }}>
        {/* Outer ring pulse */}
        <div style={{
          position: 'absolute', inset: -16,
          borderRadius: '50%',
          border: '1px solid rgba(196,154,46,0.2)',
          animation: 'ats-ring-pulse 2s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: -28,
          borderRadius: '50%',
          border: '1px solid rgba(196,154,46,0.1)',
          animation: 'ats-ring-pulse 2s ease-in-out infinite 0.4s',
        }} />

        {/* Logo circle */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #C49A2E 0%, #E4C875 50%, #B8862E 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(196,154,46,0.35), 0 0 80px rgba(196,154,46,0.15)',
          animation: 'ats-logo-float 3s ease-in-out infinite',
          position: 'relative', zIndex: 1,
        }}>
          <span style={{
            color: '#0D1B2E', fontWeight: 900,
            fontSize: '1.3rem', letterSpacing: '0.06em',
            fontFamily: 'Inter, sans-serif',
          }}>ATS</span>
        </div>
      </div>

      {/* Brand name */}
      <div style={{
        color: '#fff', fontWeight: 700, fontSize: '1.1rem',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        marginBottom: 6, opacity: 0.9,
      }}>
        Apostolic Training School
      </div>
      <div style={{
        color: 'rgba(196,154,46,0.8)', fontSize: '0.75rem',
        letterSpacing: '0.2em', textTransform: 'uppercase',
        marginBottom: 48,
      }}>
        Admin Portal
      </div>

      {/* Progress bar */}
      <div style={{ width: 280, marginBottom: 20 }}>
        <div style={{
          height: 3, background: 'rgba(255,255,255,0.08)',
          borderRadius: 100, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #C49A2E, #E4C875, #C49A2E)',
            backgroundSize: '200% 100%',
            borderRadius: 100,
            transition: 'width 0.15s ease-out',
            animation: 'ats-shimmer-bar 1.8s linear infinite',
          }} />
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        color: 'rgba(255,255,255,0.38)', fontSize: '0.78rem',
        letterSpacing: '0.04em', height: 20,
        animation: 'ats-fade-cycle 0.9s ease-in-out',
        animationFillMode: 'both',
      }}>
        {tagline}
      </div>

      {/* Dot row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'rgba(196,154,46,0.5)',
            animation: `ats-dot-bounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes ats-ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.12); opacity: 0.2; }
        }
        @keyframes ats-logo-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes ats-shimmer-bar {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes ats-dot-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
        @keyframes ats-fade-cycle {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
