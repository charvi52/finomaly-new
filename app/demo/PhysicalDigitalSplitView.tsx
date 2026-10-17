'use client';

import { useMemo } from 'react';
import { KeystrokeEvent, NormVector, RawVector, generateSignatureId } from './biometrics';

interface Props {
  activeKey: string | null;
  keystrokes: KeystrokeEvent[];
  latestHoldMs: number | null;
  latestFlightMs: number | null;
  wpm: number;
  normVector: NormVector | null;
  score: number | null; // Match score (0-1) or accuracy (0-100)
  scoreType?: 'match' | 'accuracy';
  accentColor?: string;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export default function PhysicalDigitalSplitView({
  activeKey,
  keystrokes,
  latestHoldMs,
  latestFlightMs,
  wpm,
  normVector,
  score,
  scoreType = 'match',
  accentColor = '#00f5d4',
}: Props) {
  // Recent keystrokes for waveform (last 18)
  const recentStrokes = useMemo(() => {
    return keystrokes.slice(-18);
  }, [keystrokes]);

  // Normalized vector fallback if still computing
  const safeNorm = normVector || [0.45, 0.35, 0.5, 0.25, 0.2];

  // Pipeline active step calculation
  const hasKey = Boolean(activeKey);
  const hasHold = latestHoldMs !== null && latestHoldMs > 0;
  const hasFlight = latestFlightMs !== null && latestFlightMs > 0;
  const hasSpeed = wpm > 0;
  const hasVector = Boolean(normVector);
  const hasScore = score !== null;

  // Radar points for right digital side (cx: 60, cy: 60, r: 16 to 48)
  const radarPoints = useMemo(() => {
    const cx = 60;
    const cy = 60;
    return safeNorm
      .map((val, i) => {
        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const r = 16 + val * 34;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [safeNorm]);

  const scoreDisplay = score !== null
    ? scoreType === 'accuracy'
      ? `${Math.round(score)}%`
      : `${Math.round(score * 100)}%`
    : '--%';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        borderRadius: 12,
        background: 'rgba(5, 10, 12, 0.92)',
        border: '1px solid rgba(0, 245, 212, 0.25)',
        padding: '0.85rem 1rem',
        fontFamily: 'JetBrains Mono, monospace',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        marginBottom: '0.85rem',
      }}
    >
      {/* ── TOP: LIVE TRANSLATION PIPELINE BAR ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: accentColor, fontWeight: 700 }}>
            ⚡ LIVE TRANSLATION PIPELINE: PHYSICAL → DIGITAL
          </span>
          <span style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)' }}>
            REAL-TIME TELEMETRY CONVERSION
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
            background: 'rgba(0,0,0,0.4)',
            padding: '5px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {[
            { label: '1. KEY PRESS', value: activeKey ? `'${activeKey.toUpperCase()}'` : '—', active: hasKey },
            { label: '2. HOLD TIME', value: latestHoldMs ? `${Math.round(latestHoldMs)}ms` : '—', active: hasHold },
            { label: '3. FLIGHT GAP', value: latestFlightMs ? `${Math.round(latestFlightMs)}ms` : '—', active: hasFlight },
            { label: '4. SPEED', value: wpm > 0 ? `${Math.round(wpm)} WPM` : '—', active: hasSpeed },
            { label: '5. NORM VECTOR', value: hasVector ? '5D Float' : '—', active: hasVector },
            { label: '6. SIGNATURE', value: hasVector ? 'Dynamic' : '—', active: hasVector },
            { label: '7. MATCH SCORE', value: scoreDisplay, active: hasScore },
          ].map((stage, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 2px',
                borderRadius: 5,
                background: stage.active ? `${accentColor}18` : 'rgba(255,255,255,0.02)',
                border: stage.active ? `1px solid ${accentColor}60` : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  fontSize: '0.52rem',
                  letterSpacing: '0.04em',
                  color: stage.active ? accentColor : 'var(--muted-foreground)',
                  fontWeight: stage.active ? 700 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.label}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: stage.active ? '#ffffff' : 'rgba(255,255,255,0.25)',
                  marginTop: 2,
                }}
              >
                {stage.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SPLIT VIEW: PHYSICAL (LEFT) | TRANSLATOR (CENTER) | DIGITAL (RIGHT) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr auto 1fr',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 10,
          padding: '0.65rem 0.85rem',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* ── LEFT: PHYSICAL REALM ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.64rem', color: '#ff9f43', fontWeight: 700, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff9f43', boxShadow: '0 0 6px #ff9f43' }} />
              PHYSICAL REALM // MUSCLE MEMORY
            </span>
            <span style={{ fontSize: '0.58rem', color: 'var(--muted-foreground)' }}>HUMAN HARDWARE</span>
          </div>

          {/* Interactive Keyboard Graphic */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              background: '#0a0e10',
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                {row.map((k) => {
                  const isHit = activeKey && activeKey.toUpperCase() === k;
                  return (
                    <div
                      key={k}
                      style={{
                        width: 22,
                        height: 20,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.54rem',
                        fontWeight: 700,
                        background: isHit ? accentColor : 'rgba(255,255,255,0.05)',
                        color: isHit ? '#000000' : 'rgba(255,255,255,0.5)',
                        border: isHit ? `1px solid ${accentColor}` : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: isHit ? `0 0 10px ${accentColor}` : 'none',
                        transform: isHit ? 'scale(1.18)' : 'scale(1)',
                        transition: 'all 0.08s ease',
                      }}
                    >
                      {k}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Timing waveform strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: '0.55rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>WAVE:</span>
            <div
              style={{
                flex: 1,
                height: 24,
                background: '#070b0c',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 2,
                padding: '2px 4px',
                overflow: 'hidden',
              }}
            >
              {recentStrokes.length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', alignSelf: 'center' }}>
                  Awaiting physical keystrokes…
                </div>
              ) : (
                recentStrokes.map((s, idx) => {
                  const h = Math.min(20, Math.max(4, (s.holdTime / 220) * 20));
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: `${h}px`,
                        background: idx === recentStrokes.length - 1 ? accentColor : 'rgba(0, 245, 212, 0.45)',
                        borderRadius: 1,
                        boxShadow: idx === recentStrokes.length - 1 ? `0 0 6px ${accentColor}` : 'none',
                        transition: 'height 0.1s ease',
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── CENTER: TRANSLATOR CONNECTOR ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(0,245,212,0.15), rgba(255,107,53,0.15))',
              border: '1px solid rgba(0, 245, 212, 0.4)',
              textAlign: 'center',
              boxShadow: '0 0 14px rgba(0, 245, 212, 0.2)',
            }}
          >
            <span style={{ fontSize: '0.52rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', display: 'block' }}>
              BRIDGE THE GAP
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
              FINOMALY
            </span>
            <span style={{ fontSize: '0.52rem', color: accentColor, display: 'block', fontWeight: 700 }}>
              TRANSLATOR ⇄
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: accentColor, marginTop: 4, animation: 'fp-breathe 1.2s infinite' }}>
            ▶▶▶
          </div>
        </div>

        {/* ── RIGHT: DIGITAL REALM ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.64rem', color: accentColor, fontWeight: 700, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
              DIGITAL REALM // IDENTITY SIGNAL
            </span>
            <span style={{ fontSize: '0.58rem', color: 'var(--muted-foreground)' }}>ZERO-TRUST</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a0e10',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Mini Radar */}
            <svg width="60" height="60" viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
              {[25, 45].map((r) => (
                <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              ))}
              <polygon
                points={radarPoints}
                fill={`${accentColor}25`}
                stroke={accentColor}
                strokeWidth="1.8"
                style={{ transition: 'all 0.2s ease' }}
              />
              <circle cx="60" cy="60" r="2.5" fill={accentColor} />
            </svg>

            {/* Score & Vector stats */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.56rem', color: 'var(--muted-foreground)', display: 'block' }}>
                {scoreType === 'accuracy' ? 'BASELINE ACCURACY' : 'IDENTITY MATCH'}
              </span>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: accentColor,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: 1.1,
                }}
              >
                {scoreDisplay}
              </span>
              <span style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginTop: 2 }}>
                5D Vector Normalized
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
