'use client';

import React from 'react';

/**
 * 1. CLEAN BATCH GROWTH GRAPH & SINGLE-BATCH BREAKDOWN
 * - If data is empty: renders an elegant SVG empty state (no fake mock data!)
 * - If data has 1 batch: renders an executive Programme Distribution Card
 * - If data has >1 batches: renders a horizontal stacked-bar comparison, one
 *   row per batch, so long batch names have room on the left instead of
 *   colliding as x-axis labels under a line chart
 */
export function CleanGrowthGraph({ data = [] }) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid #F1F5F9', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div
              title={b.name}
              style={{
                fontSize: '1rem', fontWeight: 800, color: 'var(--navy)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240,
              }}
            >
              {b.name}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
              Batch Code: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)' }}>#{b.code}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
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

  // Multi-batch comparison: one horizontal stacked bar per batch. A
  // categorical x-axis of batch names/codes doesn't scale past a handful of
  // batches — their labels collide no matter how wide the chart gets. A
  // horizontal bar puts the label to the left, where long names have real
  // room, and the list simply scrolls vertically once there are many rows.
  const SEGMENTS = [
    { key: 'mem', label: 'Membership', color: '#2563EB' },
    { key: 'mit', label: 'MIT', color: '#D97706', barColor: '#F59E0B' },
    { key: 'proc', label: 'Proclaimers', color: '#7C3AED', barColor: '#8B5CF6' },
  ];

  const rows = data
    .map((d) => ({ ...d, total: d.total ?? ((d.mem || 0) + (d.mit || 0) + (d.proc || 0)) }))
    .sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...rows.map((d) => d.total), 1);
  const showScroll = rows.length > 7;

  return (
    <div style={{ width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 16, fontSize: '0.78rem', fontWeight: 700, flexWrap: 'wrap' }}>
        {SEGMENTS.map((s) => (
          <span key={s.key} style={{ color: s.color }}>● {s.label}</span>
        ))}
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        maxHeight: showScroll ? 280 : undefined,
        overflowY: showScroll ? 'auto' : 'visible',
        paddingRight: showScroll ? 6 : 0,
      }}>
        {rows.map((d) => {
          const total = d.total;
          const barSegments = SEGMENTS
            .map((s) => ({ ...s, val: d[s.key] || 0 }))
            .filter((s) => s.val > 0);

          return (
            <div key={d.id || d.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                title={`${d.name} (#${d.code})`}
                style={{
                  width: 96, flexShrink: 0, fontSize: '0.76rem', fontWeight: 700, color: 'var(--navy)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {d.name}
              </div>

              <div style={{ flex: 1, height: 20, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}>
                {total > 0 && (
                  <div style={{ width: `${Math.max((total / maxTotal) * 100, 3)}%`, height: '100%', display: 'flex' }}>
                    {barSegments.map((s, i) => (
                      <div
                        key={s.key}
                        title={`${s.label}: ${s.val}`}
                        style={{
                          width: `${(s.val / total) * 100}%`,
                          height: '100%',
                          background: s.barColor || s.color,
                          borderLeft: i > 0 ? '2px solid #F1F5F9' : 'none',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ width: 36, flexShrink: 0, textAlign: 'right', fontSize: '0.8rem', fontWeight: 800, color: 'var(--navy)' }}>
                {total}
              </div>
            </div>
          );
        })}
      </div>
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

