'use client';

import React, { useState } from 'react';

/**
 * 1. CLEAN MULTI-LINE BATCH GROWTH GRAPH (Membership, MIT, Proclaimers Trend Lines)
 */
export function CleanGrowthGraph({ data = [] }) {
  const [activePoint, setActivePoint] = useState(null);

  const graphData = data && data.length > 0 ? [...data].reverse() : [
    { code: '001', name: 'Batch 1', total: 12, mem: 6, mit: 4, proc: 2 },
    { code: '002', name: 'Batch 2', total: 24, mem: 14, mit: 6, proc: 4 },
    { code: '003', name: 'Batch 3', total: 38, mem: 20, mit: 10, proc: 8 },
  ];

  const maxTotal = Math.max(...graphData.map((d) => d.total), 10);
  const maxY = Math.ceil(maxTotal / 5) * 5 || 10;

  const width = 500;
  const height = 230;
  const margin = { top: 35, right: 35, bottom: 40, left: 55 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Compute Coordinates for Membership, MIT, and Proclaimers
  const getCoords = (key, yOffset = 0) => graphData.map((d, idx) => {
    const x = margin.left + (graphData.length === 1 ? plotW / 2 : (idx / (graphData.length - 1)) * plotW);
    const rawY = margin.top + plotH - (d[key] / maxY) * plotH;
    const y = d[key] === 0 ? rawY + yOffset : rawY;
    return { ...d, x, y, val: d[key] };
  });

  const memPoints = getCoords('mem', 0);
  const mitPoints = getCoords('mit', -4); // Subtle offset for MIT when 0
  const procPoints = getCoords('proc', 4);

  // Build SVG Path d string
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

  const yTicks = [0, maxY * 0.33, maxY * 0.66, maxY].map(Math.round);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Horizontal Clean Grid Lines */}
        {yTicks.map((val, idx) => {
          const yPos = margin.top + plotH - (val / maxY) * plotH;
          return (
            <g key={idx}>
              <line x1={margin.left} y1={yPos} x2={width - margin.right} y2={yPos} stroke="#F1F5F9" strokeWidth="1.5" />
              <text x={margin.left - 10} y={yPos + 4} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#94A3B8">
                {val}
              </text>
            </g>
          );
        })}

        {/* Vertical Guide Lines for Batches */}
        {memPoints.map((pt, i) => (
          <g key={i}>
            <line x1={pt.x} y1={margin.top} x2={pt.x} y2={margin.top + plotH} stroke="#F8FAFC" strokeWidth="1.5" />
            <text x={pt.x} y={margin.top + plotH + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
              #{pt.code}
            </text>
          </g>
        ))}

        {/* Membership Trend Line (Royal Blue) */}
        {memPoints.length > 1 ? (
          <path d={memD} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
        ) : memPoints.length === 1 ? (
          <line x1={margin.left} y1={memPoints[0].y} x2={width - margin.right} y2={memPoints[0].y} stroke="#2563EB" strokeWidth="3" />
        ) : null}

        {/* MIT Trend Line (Vivid Amber Gold) */}
        {mitPoints.length > 1 ? (
          <path d={mitD} fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
        ) : mitPoints.length === 1 ? (
          <line x1={margin.left} y1={mitPoints[0].y} x2={width - margin.right} y2={mitPoints[0].y} stroke="#F59E0B" strokeWidth="3.5" />
        ) : null}

        {/* Proclaimers Trend Line (Purple) */}
        {procPoints.length > 1 ? (
          <path d={procD} fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
        ) : procPoints.length === 1 ? (
          <line x1={margin.left} y1={procPoints[0].y} x2={width - margin.right} y2={procPoints[0].y} stroke="#8B5CF6" strokeWidth="3" />
        ) : null}

        {/* Plot Nodes & Value Badges for Membership */}
        {memPoints.map((pt, i) => (
          <g key={`mem-${i}`} onMouseEnter={() => setActivePoint({ label: 'Membership', ...pt })} onMouseLeave={() => setActivePoint(null)} style={{ cursor: 'pointer' }}>
            <circle cx={pt.x} cy={pt.y} r="5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="3" />
            <circle cx={pt.x} cy={pt.y} r="2" fill="#2563EB" />
            <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="10" fontWeight="800" fill="#2563EB">
              {pt.val}
            </text>
          </g>
        ))}

        {/* Plot Nodes & Value Badges for MIT */}
        {mitPoints.map((pt, i) => (
          <g key={`mit-${i}`} onMouseEnter={() => setActivePoint({ label: 'MIT', ...pt })} onMouseLeave={() => setActivePoint(null)} style={{ cursor: 'pointer' }}>
            <circle cx={pt.x} cy={pt.y} r="5" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="3.5" />
            <circle cx={pt.x} cy={pt.y} r="2" fill="#F59E0B" />
            <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="10" fontWeight="800" fill="#D97706">
              {pt.val}
            </text>
          </g>
        ))}

        {/* Plot Nodes & Value Badges for Proclaimers */}
        {procPoints.map((pt, i) => (
          <g key={`proc-${i}`} onMouseEnter={() => setActivePoint({ label: 'Proclaimers', ...pt })} onMouseLeave={() => setActivePoint(null)} style={{ cursor: 'pointer' }}>
            <circle cx={pt.x} cy={pt.y} r="5" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="3" />
            <circle cx={pt.x} cy={pt.y} r="2" fill="#8B5CF6" />
            <text x={pt.x} y={pt.y + 16} textAnchor="middle" fontSize="10" fontWeight="800" fill="#8B5CF6">
              {pt.val}
            </text>
          </g>
        ))}
      </svg>

      {/* Neat Legend */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 4, fontSize: '0.8rem', fontWeight: 700 }}>
        <span style={{ color: '#2563EB' }}>● Membership</span>
        <span style={{ color: '#F59E0B' }}>● MIT</span>
        <span style={{ color: '#8B5CF6' }}>● Proclaimers</span>
      </div>

      {/* Hover Badge */}
      {activePoint && (
        <div style={{
          position: 'absolute', top: 6, right: 10,
          background: '#0F172A', color: '#FFF',
          padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {activePoint.label} (#{activePoint.code}): {activePoint.val} Students
        </div>
      )}
    </div>
  );
}

/**
 * 2. CLEAN DEMOGRAPHICS GRAPH (Gender & Membership First Timers Bars)
 */
export function CleanDemographicsGraph({ maleCount = 0, femaleCount = 0, firstTimerCount = 0, membershipTotal = 0 }) {
  const regularCount = Math.max(0, membershipTotal - firstTimerCount);

  const demoData = [
    { label: 'Male', val: maleCount, color: '#2563EB' },
    { label: 'Female', val: femaleCount, color: '#E11D48' },
    { label: 'First Timers (Mem)', val: firstTimerCount, color: '#D97706' },
    { label: 'Regular (Mem)', val: regularCount, color: '#059669' },
  ];

  const maxY = Math.ceil(Math.max(maleCount, femaleCount, firstTimerCount, regularCount, 5) / 5) * 5 || 10;

  const width = 500;
  const height = 220;
  const margin = { top: 30, right: 30, bottom: 40, left: 60 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Evenly distribute columns inside plot area (no overlap with Y-axis numbers)
  const step = plotW / demoData.length;

  const points = demoData.map((d, idx) => {
    const x = margin.left + step * idx + step / 2;
    const y = margin.top + plotH - (d.val / maxY) * plotH;
    return { ...d, x, y };
  });

  const yTicks = [0, maxY * 0.33, maxY * 0.66, maxY].map(Math.round);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Horizontal Grid Lines */}
        {yTicks.map((val, idx) => {
          const yPos = margin.top + plotH - (val / maxY) * plotH;
          return (
            <g key={idx}>
              <line x1={margin.left - 5} y1={yPos} x2={width - margin.right} y2={yPos} stroke="#F1F5F9" strokeWidth="1.5" />
              <text x={margin.left - 12} y={yPos + 4} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#94A3B8">
                {val}
              </text>
            </g>
          );
        })}

        {/* Vertical Y-Axis Divider Line */}
        <line x1={margin.left - 5} y1={margin.top - 5} x2={margin.left - 5} y2={margin.top + plotH} stroke="#E2E8F0" strokeWidth="1" />

        {/* Clean Bars & Value Labels */}
        {points.map((pt, i) => {
          const barWidth = 32;
          const barH = margin.top + plotH - pt.y;

          return (
            <g key={i}>
              {/* Vertical Guide Line */}
              <line x1={pt.x} y1={pt.y} x2={pt.x} y2={margin.top + plotH} stroke={pt.color} strokeDasharray="2 2" opacity="0.3" />

              {/* Clean Rounded Bar */}
              <rect
                x={pt.x - barWidth / 2} y={pt.y}
                width={barWidth} height={Math.max(barH, 4)}
                fill={pt.color} rx="6" opacity="0.9"
              />

              {/* Count Value Badge ABOVE Bar (Never Overlapping) */}
              <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="12" fontWeight="800" fill={pt.color}>
                {pt.val}
              </text>

              {/* Category Label at Bottom */}
              <text x={pt.x} y={margin.top + plotH + 20} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#334155">
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4, fontSize: '0.78rem', fontWeight: 700 }}>
        <span style={{ color: '#2563EB' }}>● Male ({maleCount})</span>
        <span style={{ color: '#E11D48' }}>● Female ({femaleCount})</span>
        <span style={{ color: '#D97706' }}>⭐ Membership 1st Timers ({firstTimerCount})</span>
      </div>
    </div>
  );
}
