'use client';

import React, { useState } from 'react';

/**
 * 1. CLEAN BATCH GROWTH GRAPH & SINGLE-BATCH BREAKDOWN
 * - If data is empty: renders an elegant SVG empty state (no fake mock data!)
 * - If data has 1 batch: renders an executive Programme Distribution Card
 * - If data has >1 batches: renders smooth multi-line trend bezier curves
 */
export function CleanGrowthGraph({ data = [] }) {
  const [activePoint, setActivePoint] = useState(null);

  // Empty state: no fake/mock dummy data
  if (!data || data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 230,
        background: '#F8FAFC',
        borderRadius: 12,
        border: '1px dashed #CBD5E1',
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748B',
          fontSize: '1.2rem',
          marginBottom: 10,
        }}>
          <i className="fa-solid fa-chart-line"></i>
        </div>
        <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.92rem', marginBottom: 4 }}>
          No Enrolment Trend Data
        </div>
        <div style={{ color: '#94A3B8', fontSize: '0.8rem', maxWidth: 280 }}>
          Register students into active batches to view multi-batch comparative enrolment trends.
        </div>
      </div>
    );
  }

  // Single batch selected: render an executive Programme Enrolment Breakdown
  if (data.length === 1) {
    const b = data[0];
    const total = b.total || ((b.mem || 0) + (b.mit || 0) + (b.proc || 0)) || 0;
    const memPct = total > 0 ? Math.round(((b.mem || 0) / total) * 100) : 0;
    const mitPct = total > 0 ? Math.round(((b.mit || 0) / total) * 100) : 0;
    const procPct = total > 0 ? Math.round(((b.proc || 0) / total) * 100) : 0;

    return (
      <div style={{ height: 230, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 0' }}>
        {/* Header Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>{b.name}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
              Batch Code: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)' }}>#{b.code}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginTop: 4 }}>
              Total Enrolled
            </div>
          </div>
        </div>

        {/* Programme Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Membership */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: 5 }}>
              <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }}></span>
                Membership
              </span>
              <span style={{ color: 'var(--navy)' }}>
                {b.mem || 0} students <span style={{ color: '#64748B', fontWeight: 600 }}>({memPct}%)</span>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{ width: `${memPct}%`, height: '100%', background: '#2563EB', borderRadius: 99, transition: 'width 0.5s ease' }}></div>
            </div>
          </div>

          {/* MIT */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: 5 }}>
              <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
                Workers-in-Training (MIT)
              </span>
              <span style={{ color: 'var(--navy)' }}>
                {b.mit || 0} students <span style={{ color: '#64748B', fontWeight: 600 }}>({mitPct}%)</span>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{ width: `${mitPct}%`, height: '100%', background: '#F59E0B', borderRadius: 99, transition: 'width 0.5s ease' }}></div>
            </div>
          </div>

          {/* Proclaimers */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: 5 }}>
              <span style={{ color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', display: 'inline-block' }}></span>
                Proclaimers
              </span>
              <span style={{ color: 'var(--navy)' }}>
                {b.proc || 0} students <span style={{ color: '#64748B', fontWeight: 600 }}>({procPct}%)</span>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{ width: `${procPct}%`, height: '100%', background: '#8B5CF6', borderRadius: 99, transition: 'width 0.5s ease' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multi-batch comparative trend chart
  const graphData = [...data].reverse();
  const maxTotal = Math.max(...graphData.map((d) => Math.max(d.total || 0, d.mem || 0, d.mit || 0, d.proc || 0)), 5);
  const maxY = Math.ceil(maxTotal / 5) * 5 || 10;

  const width = 500;
  const height = 230;
  const margin = { top: 30, right: 30, bottom: 42, left: 45 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Compute clean Coordinates
  const getCoords = (key) => graphData.map((d, idx) => {
    const x = margin.left + (idx / (graphData.length - 1)) * plotW;
    const y = margin.top + plotH - ((d[key] || 0) / maxY) * plotH;
    return { ...d, x, y, val: d[key] || 0 };
  });

  const memPoints = getCoords('mem');
  const mitPoints = getCoords('mit');
  const procPoints = getCoords('proc');

  // Smooth SVG Bezier Path builder
  const buildPath = (pts) => pts.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (pt.x - prev.x) / 2;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, '');

  const memD = buildPath(memPoints);
  const mitD = buildPath(mitPoints);
  const procD = buildPath(procPoints);

  const yTicks = [0, Math.round(maxY * 0.5), maxY];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Horizontal Grid Lines */}
        {yTicks.map((val, idx) => {
          const yPos = margin.top + plotH - (val / maxY) * plotH;
          return (
            <g key={idx}>
              <line x1={margin.left} y1={yPos} x2={width - margin.right} y2={yPos} stroke="#F1F5F9" strokeWidth="1.5" />
              <text x={margin.left - 10} y={yPos + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#94A3B8">
                {val}
              </text>
            </g>
          );
        })}

        {/* Vertical Guide Lines & Batch Code Labels */}
        {memPoints.map((pt, i) => (
          <g key={i}>
            <line x1={pt.x} y1={margin.top} x2={pt.x} y2={margin.top + plotH} stroke="#F8FAFC" strokeWidth="1.5" />
            <text x={pt.x} y={margin.top + plotH + 18} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#475569">
              #{pt.code}
            </text>
          </g>
        ))}

        {/* Membership Trend Line (Royal Blue) */}
        <path d={memD} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />

        {/* MIT Trend Line (Vivid Amber Gold) */}
        <path d={mitD} fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />

        {/* Proclaimers Trend Line (Purple) */}
        <path d={procD} fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />

        {/* Clean Point Nodes with Hover Trigger */}
        {memPoints.map((pt, i) => (
          <g
            key={`mem-${i}`}
            onMouseEnter={() => setActivePoint({ label: 'Membership', color: '#2563EB', ...pt })}
            onMouseLeave={() => setActivePoint(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={pt.x} cy={pt.y} r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2.5" />
          </g>
        ))}

        {mitPoints.map((pt, i) => (
          <g
            key={`mit-${i}`}
            onMouseEnter={() => setActivePoint({ label: 'MIT', color: '#F59E0B', ...pt })}
            onMouseLeave={() => setActivePoint(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={pt.x} cy={pt.y} r="4" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2.5" />
          </g>
        ))}

        {procPoints.map((pt, i) => (
          <g
            key={`proc-${i}`}
            onMouseEnter={() => setActivePoint({ label: 'Proclaimers', color: '#8B5CF6', ...pt })}
            onMouseLeave={() => setActivePoint(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={pt.x} cy={pt.y} r="4" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="2.5" />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 2, fontSize: '0.78rem', fontWeight: 700 }}>
        <span style={{ color: '#2563EB' }}>● Membership</span>
        <span style={{ color: '#D97706' }}>● MIT</span>
        <span style={{ color: '#7C3AED' }}>● Proclaimers</span>
      </div>

      {/* Modern Hover Tooltip */}
      {activePoint && (
        <div style={{
          position: 'absolute',
          top: 6,
          right: 12,
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '5px 12px',
          borderRadius: 8,
          fontSize: '0.76rem',
          fontWeight: 600,
          boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: activePoint.color }}></span>
          <span>{activePoint.name} (#{activePoint.code}): <strong>{activePoint.val}</strong> {activePoint.label}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 2. CLEAN DEMOGRAPHICS GRAPH (Gender & Membership First Timers Bars)
 * Handles 0-values gracefully with an empty state.
 */
export function CleanDemographicsGraph({ maleCount = 0, femaleCount = 0, firstTimerCount = 0, membershipTotal = 0 }) {
  const regularCount = Math.max(0, membershipTotal - firstTimerCount);
  const totalDemo = maleCount + femaleCount + firstTimerCount + regularCount;

  // Graceful empty state
  if (totalDemo === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 230,
        background: '#F8FAFC',
        borderRadius: 12,
        border: '1px dashed #CBD5E1',
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748B',
          fontSize: '1.2rem',
          marginBottom: 10,
        }}>
          <i className="fa-solid fa-venus-mars"></i>
        </div>
        <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.92rem', marginBottom: 4 }}>
          No Demographic Records
        </div>
        <div style={{ color: '#94A3B8', fontSize: '0.8rem', maxWidth: 280 }}>
          No gender or first-timer statistics recorded for the current batch selection.
        </div>
      </div>
    );
  }

  const demoData = [
    { label: 'Male', val: maleCount, color: '#2563EB' },
    { label: 'Female', val: femaleCount, color: '#E11D48' },
    { label: '1st Timers', val: firstTimerCount, color: '#D97706' },
    { label: 'Regular', val: regularCount, color: '#059669' },
  ];

  const maxY = Math.ceil(Math.max(maleCount, femaleCount, firstTimerCount, regularCount, 5) / 5) * 5 || 10;

  const width = 500;
  const height = 230;
  const margin = { top: 30, right: 30, bottom: 42, left: 45 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Evenly distribute columns inside plot area
  const step = plotW / demoData.length;

  const points = demoData.map((d, idx) => {
    const x = margin.left + step * idx + step / 2;
    const y = margin.top + plotH - (d.val / maxY) * plotH;
    return { ...d, x, y };
  });

  const yTicks = [0, Math.round(maxY * 0.5), maxY];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Horizontal Grid Lines */}
        {yTicks.map((val, idx) => {
          const yPos = margin.top + plotH - (val / maxY) * plotH;
          return (
            <g key={idx}>
              <line x1={margin.left} y1={yPos} x2={width - margin.right} y2={yPos} stroke="#F1F5F9" strokeWidth="1.5" />
              <text x={margin.left - 10} y={yPos + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#94A3B8">
                {val}
              </text>
            </g>
          );
        })}

        {/* Clean Rounded Bars & Value Labels */}
        {points.map((pt, i) => {
          const barWidth = 34;
          const barH = margin.top + plotH - pt.y;

          return (
            <g key={i}>
              {/* Subtle vertical guideline */}
              <line x1={pt.x} y1={pt.y} x2={pt.x} y2={margin.top + plotH} stroke={pt.color} strokeDasharray="2 2" opacity="0.25" />

              {/* Rounded Bar */}
              <rect
                x={pt.x - barWidth / 2}
                y={pt.y}
                width={barWidth}
                height={Math.max(barH, 4)}
                fill={pt.color}
                rx="6"
                opacity="0.9"
              />

              {/* Count Value Badge ABOVE Bar */}
              <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={pt.color}>
                {pt.val}
              </text>

              {/* Category Label at Bottom */}
              <text x={pt.x} y={margin.top + plotH + 18} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#475569">
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Clean Legend */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 2, fontSize: '0.78rem', fontWeight: 700, flexWrap: 'wrap' }}>
        <span style={{ color: '#2563EB' }}>● Male ({maleCount})</span>
        <span style={{ color: '#E11D48' }}>● Female ({femaleCount})</span>
        <span style={{ color: '#D97706' }}>⭐ 1st Timers ({firstTimerCount})</span>
      </div>
    </div>
  );
}

