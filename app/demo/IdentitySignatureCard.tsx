'use client';

import { useMemo } from 'react';
import { RawVector, normaliseVector, generateSignatureId } from './biometrics';

interface Props {
  label: string;
  sublabel?: string;
  rawVector?: RawVector | null;
  accentColor?: string;
  highlighted?: boolean;
}

export default function IdentitySignatureCard({
  label,
  sublabel,
  rawVector,
  accentColor = '#00f5d4',
  highlighted = false,
}: Props) {
  const safeVector: RawVector = useMemo(() => {
    if (!rawVector) {
      return { avgHoldTime: 120, avgFlightTime: 100, wpm: 50, holdTimeVariance: 25, flightTimeVariance: 30 };
    }
    return {
      avgHoldTime: Number.isFinite(rawVector.avgHoldTime) ? rawVector.avgHoldTime : 120,
      avgFlightTime: Number.isFinite(rawVector.avgFlightTime) ? rawVector.avgFlightTime : 100,
      wpm: Number.isFinite(rawVector.wpm) ? rawVector.wpm : 50,
      holdTimeVariance: Number.isFinite(rawVector.holdTimeVariance) ? rawVector.holdTimeVariance : 25,
      flightTimeVariance: Number.isFinite(rawVector.flightTimeVariance) ? rawVector.flightTimeVariance : 30,
    };
  }, [rawVector]);

  const norm = useMemo(() => normaliseVector(safeVector), [safeVector]);
  const sigId = useMemo(() => generateSignatureId(safeVector), [safeVector]);

  // Compute 5-axis polygon points centered at (90, 90), radius range 25 to 75
  const polygonPoints = useMemo(() => {
    const cx = 90;
    const cy = 90;
    const minR = 26;
    const maxR = 76;

    return norm
      .map((val, i) => {
        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const r = minR + val * (maxR - minR);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [norm]);

  // Secondary concentric resonance rings based on variance
  const holdVarRadius = 30 + norm[3] * 35;
  const flightVarRadius = 25 + norm[4] * 38;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        border: highlighted ? `2px solid ${accentColor}` : `1px solid ${accentColor}40`,
        background: highlighted
          ? `linear-gradient(165deg, rgba(8, 20, 23, 0.95), rgba(13, 27, 31, 0.95))`
          : `linear-gradient(165deg, rgba(12, 17, 20, 0.85), rgba(8, 12, 14, 0.9))`,
        padding: '1.25rem',
        boxShadow: highlighted
          ? `0 0 30px ${accentColor}25, 0 10px 25px rgba(0,0,0,0.6)`
          : `0 4px 20px rgba(0,0,0,0.4)`,
        fontFamily: 'JetBrains Mono, monospace',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Background radial accent glow */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <div>
          <span
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.12em',
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              display: 'block',
            }}
          >
            {sublabel || 'NEUROMUSCULAR IDENTITY'}
          </span>
          <h4
            style={{
              margin: '3px 0 0',
              fontSize: '1.05rem',
              fontWeight: 700,
              color: accentColor,
              letterSpacing: '-0.01em',
            }}
          >
            {label}
          </h4>
        </div>
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}40`,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '0.08em',
          }}
        >
          {sigId}
        </div>
      </div>

      {/* Visual Identity Signature Shape (SVG) */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0 1rem', position: 'relative' }}>
        <svg width="180" height="180" viewBox="0 0 180 180" style={{ overflow: 'visible' }}>
          {/* Radial axis guides */}
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            const x2 = 90 + 78 * Math.cos(angle);
            const y2 = 90 + 78 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={90}
                y1={90}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                strokeDasharray="2,3"
              />
            );
          })}

          {/* Reference concentric rings */}
          {[35, 55, 75].map((r) => (
            <circle
              key={r}
              cx={90}
              cy={90}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          ))}

          {/* Dynamic variance harmonic rings */}
          <circle
            cx={90}
            cy={90}
            r={holdVarRadius}
            fill="none"
            stroke={`${accentColor}30`}
            strokeWidth="1.2"
            strokeDasharray="4,4"
          />
          <circle
            cx={90}
            cy={90}
            r={flightVarRadius}
            fill="none"
            stroke={`${accentColor}20`}
            strokeWidth="1"
          />

          {/* Core signature polygon */}
          <polygon
            points={polygonPoints}
            fill={`${accentColor}25`}
            stroke={accentColor}
            strokeWidth="2.4"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0 0 10px ${accentColor}70)`,
              transition: 'all 0.5s ease',
            }}
          />

          {/* Feature anchor points */}
          {norm.map((val, i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            const r = 26 + val * 50;
            const x = 90 + r * Math.cos(angle);
            const y = 90 + r * Math.sin(angle);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3.5"
                fill="#080c0d"
                stroke={accentColor}
                strokeWidth="2"
              />
            );
          })}

          {/* Center core emitter */}
          <circle cx={90} cy={90} r="4" fill={accentColor} />
        </svg>
      </div>

      {/* Physical metrics readout grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 8,
          padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', display: 'block' }}>HOLD DWELL</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5eef0' }}>
            {Math.round(safeVector.avgHoldTime)} <span style={{ fontSize: '0.65rem', color: accentColor }}>ms</span>
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', display: 'block' }}>FLIGHT GAP</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5eef0' }}>
            {Math.round(safeVector.avgFlightTime)} <span style={{ fontSize: '0.65rem', color: accentColor }}>ms</span>
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', display: 'block' }}>TYPING PACE</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5eef0' }}>
            {Math.round(safeVector.wpm)} <span style={{ fontSize: '0.65rem', color: accentColor }}>WPM</span>
          </span>
        </div>
      </div>
    </div>
  );
}
