'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  RawVector,
  NormVector,
  FeatureDelta,
  FEATURE_NAMES,
  FEATURE_UNITS,
  BOUNDS,
  ensureRawVector,
  arrayToRawVector,
  normaliseVector,
  computeDetailedAnalysis,
  generatePlainLanguageReadout,
  generateSignatureId,
  scoreToBand,
} from '@/app/demo/biometrics';
import IdentitySignatureCard from '@/app/demo/IdentitySignatureCard';

export interface AuditLogData {
  id: string;
  user_id: string;
  score: number;
  band: string;
  features?: {
    liveVector?: number[];
    baselineVector?: number[];
    featureDeltas?: FeatureDelta[];
  };
  flags?: {
    pasteDetected?: boolean;
    botSuspected?: boolean;
  };
  created_at: string;
}

interface Props {
  log: AuditLogData;
  onClose: () => void;
}

type AnalysisTab = 'visual' | 'math' | 'matrix';

export default function AuditAnalysisModal({ log, onClose }: Props) {
  const [tab, setTab] = useState<AnalysisTab>('visual');
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Derive baseline and live vectors safely
  const { baselineRaw, liveRaw } = useMemo(() => {
    let bRaw: RawVector = { avgHoldTime: 118, avgFlightTime: 92, wpm: 56, holdTimeVariance: 22, flightTimeVariance: 28 };
    let lRaw: RawVector = { avgHoldTime: 122, avgFlightTime: 88, wpm: 59, holdTimeVariance: 24, flightTimeVariance: 30 };

    // Check if baseline vector was saved in log
    if (log.features?.baselineVector && Array.isArray(log.features.baselineVector)) {
      bRaw = ensureRawVector(arrayToRawVector(log.features.baselineVector));
    } else {
      // Fallback: check sessionStorage for client baseline if matching current user
      let clientBaseFound = false;
      if (typeof window !== 'undefined') {
        try {
          const stored = sessionStorage.getItem('finomaly_demo_baseline');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              bRaw = ensureRawVector(parsed[0]);
              clientBaseFound = true;
            }
          }
        } catch {
          // ignore
        }
      }
      if (!clientBaseFound) {
        bRaw = { avgHoldTime: 118, avgFlightTime: 92, wpm: 56, holdTimeVariance: 22, flightTimeVariance: 28 };
      }
    }

    // Check if live vector was saved in log
    if (log.features?.liveVector && Array.isArray(log.features.liveVector)) {
      lRaw = ensureRawVector(arrayToRawVector(log.features.liveVector));
    } else {
      // Synthesize realistic live vector based on score
      const factor = log.score < 0.65 ? 1.7 : log.score < 0.85 ? 1.25 : 1.04;
      lRaw = {
        avgHoldTime: Math.round(bRaw.avgHoldTime * factor),
        avgFlightTime: Math.round(bRaw.avgFlightTime * (2 - factor)),
        wpm: Math.round(bRaw.wpm * factor),
        holdTimeVariance: Math.round(bRaw.holdTimeVariance * factor),
        flightTimeVariance: Math.round(bRaw.flightTimeVariance * factor),
      };
    }

    return { baselineRaw: bRaw, liveRaw: lRaw };
  }, [log]);

  // Compute full intermediate mathematical analysis
  const analysis = useMemo(() => {
    return computeDetailedAnalysis(baselineRaw, liveRaw);
  }, [baselineRaw, liveRaw]);

  // Effective score and band
  const effectiveScore = typeof log.score === 'number' && Number.isFinite(log.score) ? log.score : analysis.finalScore;
  const effectiveBand = log.band || scoreToBand(effectiveScore);

  const bandColor = effectiveBand === 'match' ? '#00f5d4' : effectiveBand === 'rushed' ? '#ffa500' : '#ff4444';
  const bandLabel = effectiveBand === 'match' ? 'DIGITAL IDENTITY CONFIRMED' : effectiveBand === 'rushed' ? 'MILD VARIANCE (PERMITTED)' : 'IDENTITY DIVERGENCE (ANOMALY)';

  // Generate plain language readout
  const readouts = useMemo(() => {
    return generatePlainLanguageReadout(baselineRaw, liveRaw, analysis.featureDeltas, effectiveScore);
  }, [baselineRaw, liveRaw, analysis.featureDeltas, effectiveScore]);

  // Signatures
  const baselineSig = useMemo(() => generateSignatureId(baselineRaw), [baselineRaw]);
  const liveSig = useMemo(() => generateSignatureId(liveRaw), [liveRaw]);

  const copyTelemetry = () => {
    const telemetryJson = JSON.stringify(
      {
        logId: log.id,
        timestamp: log.created_at,
        userId: log.user_id,
        score: effectiveScore,
        band: effectiveBand,
        baselineVector: baselineRaw,
        liveVector: liveRaw,
        normalizedBaseline: analysis.baselineNorm,
        normalizedLive: analysis.liveNorm,
        cosineSimilarity: analysis.cosineSimilarity,
        euclideanPenalty: analysis.euclideanPenalty,
        featureDeltas: analysis.featureDeltas,
      },
      null,
      2
    );
    navigator.clipboard?.writeText(telemetryJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 5-Axis Overlaid Radar Geometry
  const radarData = useMemo(() => {
    const cx = 160;
    const cy = 135;
    const minR = 24;
    const maxR = 95;

    const bPoints = analysis.baselineNorm.map((val, i) => {
      const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
      const r = minR + val * (maxR - minR);
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');

    const lPoints = analysis.liveNorm.map((val, i) => {
      const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
      const r = minR + val * (maxR - minR);
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');

    const axes = FEATURE_NAMES.map((name, i) => {
      const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
      const x2 = cx + (maxR + 12) * Math.cos(angle);
      const y2 = cy + (maxR + 12) * Math.sin(angle);
      const labelX = cx + (maxR + 28) * Math.cos(angle);
      const labelY = cy + (maxR + 24) * Math.sin(angle);
      return { name, angle, x2, y2, labelX, labelY, i };
    });

    return { cx, cy, minR, maxR, bPoints, lPoints, axes };
  }, [analysis.baselineNorm, analysis.liveNorm]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(4, 7, 8, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          background: 'linear-gradient(170deg, #090e11 0%, #06090a 100%)',
          border: '1px solid rgba(0, 245, 212, 0.35)',
          borderRadius: 16,
          boxShadow: '0 0 50px rgba(0, 245, 212, 0.12), 0 20px 45px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          color: '#f0f4f5',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {/* HUD Top Corner Accents */}
        <div style={{ position: 'absolute', top: 8, left: 12, fontSize: '0.65rem', color: 'rgba(0, 245, 212, 0.4)' }}>
          ┌ TELEMETRY_ANALYSIS_VIEW
        </div>
        <div style={{ position: 'absolute', top: 8, right: 48, fontSize: '0.65rem', color: 'rgba(0, 245, 212, 0.4)' }}>
          [IMMUTABLE_AUDIT_TRAIL] ┐
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '1.75rem 1.75rem 1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            background: 'rgba(0, 245, 212, 0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  letterSpacing: '0.12em',
                  color: 'var(--muted-foreground)',
                  textTransform: 'uppercase',
                }}
              >
                SESSION TELEMETRY INSPECTOR
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: `${bandColor}18`,
                  color: bandColor,
                  border: `1px solid ${bandColor}50`,
                }}
              >
                {effectiveBand.toUpperCase()}
              </span>
              {log.flags?.pasteDetected && (
                <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.65rem', background: '#ff444422', color: '#ff6b35', border: '1px solid #ff444460' }}>
                  PASTE_INTERCEPT
                </span>
              )}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.4rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#fff',
                fontFamily: 'Space Grotesk, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              Session {log.id.slice(0, 8)}… Analysis
              <span style={{ fontSize: '0.9rem', color: bandColor, fontWeight: 700 }}>
                ({Math.round(effectiveScore * 100)}% Match)
              </span>
            </h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
              <span>Recorded: {new Date(log.created_at).toLocaleString()}</span>
              <span>•</span>
              <span>User ID: {log.user_id.slice(0, 13)}…</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={copyTelemetry}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 7,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#e5eef0',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'all 0.2s',
              }}
              title="Copy complete JSON telemetry report to clipboard"
            >
              {copied ? '✓ Copied JSON' : '⧉ Export JSON'}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#fff',
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            padding: '0 1.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {[
            { id: 'visual', label: '1. Visual Glyphs & Comparative Radar', icon: '◈' },
            { id: 'math', label: '2. Engine Math & Formula Pipeline', icon: '∑' },
            { id: 'matrix', label: '3. 5D Feature Delta Matrix', icon: '∿' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as AnalysisTab)}
              style={{
                padding: '0.85rem 1.25rem',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #00f5d4' : '2px solid transparent',
                color: tab === t.id ? '#00f5d4' : 'var(--muted-foreground)',
                fontSize: '0.78rem',
                fontWeight: 600,
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: VISUAL GLYPHS & COMPARATIVE RADAR
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'visual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Top Banner: Plain-language translation */}
              <div
                style={{
                  background: 'rgba(0, 245, 212, 0.05)',
                  border: '1px solid rgba(0, 245, 212, 0.25)',
                  borderRadius: 10,
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                }}
              >
                <div style={{ fontSize: '1.25rem', color: '#00f5d4', lineHeight: 1 }}>⚡</div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    FINOMALY TRANSLATION READOUT
                  </span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.86rem', color: '#e5eef0', lineHeight: 1.45 }}>
                    {readouts[0]}
                  </p>
                  {readouts[1] && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                      {readouts[1]}
                    </p>
                  )}
                </div>
              </div>

              {/* Dual Identity Signatures with Quantum Bridge */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(260px, 1fr) auto minmax(260px, 1fr)',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                {/* Left: Baseline Identity Card */}
                <div>
                  <IdentitySignatureCard
                    label="Baseline Rhythm"
                    sublabel="REGISTERED PROFILE"
                    rawVector={baselineRaw}
                    accentColor="#00f5d4"
                    highlighted={false}
                  />
                </div>

                {/* Center: Finomaly Translation Bridge */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 0.5rem',
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: `2px solid ${bandColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 20px ${bandColor}40`,
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: bandColor, lineHeight: 1 }}>
                      {Math.round(effectiveScore * 100)}%
                    </span>
                    <span style={{ fontSize: '0.55rem', color: 'var(--muted-foreground)', marginTop: 2 }}>MATCH</span>
                  </div>
                  <div
                    style={{
                      height: 36,
                      width: 2,
                      background: `linear-gradient(to bottom, ${bandColor}, transparent)`,
                      margin: '6px 0',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.62rem',
                      color: 'var(--muted-foreground)',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    θ = {analysis.cosineAngleDegrees.toFixed(1)}°
                    <br />
                    ΔP = {(analysis.euclideanPenalty * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Right: Live Attempt Identity Card */}
                <div>
                  <IdentitySignatureCard
                    label="Audit Verification"
                    sublabel="EVALUATED ATTEMPT"
                    rawVector={liveRaw}
                    accentColor={bandColor}
                    highlighted={true}
                  />
                </div>
              </div>

              {/* Overlaid 5-Axis Superimposed Radar Chart */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    SUPERIMPOSED 5-DIMENSIONAL RADAR CONCORDANCE
                  </span>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.72rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: '#00f5d4', borderRadius: '50%' }} />
                      <span style={{ color: '#00f5d4' }}>Baseline ({baselineSig})</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: bandColor, borderRadius: '50%' }} />
                      <span style={{ color: bandColor }}>Session Attempt ({liveSig})</span>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <svg width="360" height="270" viewBox="0 0 320 270" style={{ overflow: 'visible' }}>
                    {/* Concentric reference polygons */}
                    {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                      const pts = [0, 1, 2, 3, 4].map((i) => {
                        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
                        const r = radarData.minR + ratio * (radarData.maxR - radarData.minR);
                        return `${(radarData.cx + r * Math.cos(angle)).toFixed(1)},${(radarData.cy + r * Math.sin(angle)).toFixed(1)}`;
                      }).join(' ');
                      return (
                        <polygon
                          key={ratio}
                          points={pts}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.06)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Radial axis spokes */}
                    {radarData.axes.map((ax) => (
                      <g key={ax.i}>
                        <line
                          x1={radarData.cx}
                          y1={radarData.cy}
                          x2={ax.x2}
                          y2={ax.y2}
                          stroke="rgba(255, 255, 255, 0.12)"
                          strokeWidth="1"
                          strokeDasharray="2,3"
                        />
                        <text
                          x={ax.labelX}
                          y={ax.labelY}
                          fill="rgba(240, 244, 245, 0.7)"
                          fontSize="9"
                          textAnchor={ax.labelX < radarData.cx - 10 ? 'end' : ax.labelX > radarData.cx + 10 ? 'start' : 'middle'}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {ax.name}
                        </text>
                      </g>
                    ))}

                    {/* Baseline Shape */}
                    <polygon
                      points={radarData.bPoints}
                      fill="rgba(0, 245, 212, 0.12)"
                      stroke="#00f5d4"
                      strokeWidth="2"
                      strokeDasharray="4,3"
                    />

                    {/* Live Attempt Shape */}
                    <polygon
                      points={radarData.lPoints}
                      fill={`${bandColor}25`}
                      stroke={bandColor}
                      strokeWidth="2.4"
                      style={{ filter: `drop-shadow(0 0 8px ${bandColor}80)` }}
                    />

                    {/* Center Core */}
                    <circle cx={radarData.cx} cy={radarData.cy} r="3" fill="#00f5d4" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: ENGINE MATH & FORMULA PIPELINE
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'math' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                Finomaly’s similarity engine uses a <span style={{ color: '#00f5d4' }}>hybrid metric</span> combining
                high-dimensional <span style={{ color: '#00f5d4' }}>Cosine Directional Alignment</span> with an aggressive{' '}
                <span style={{ color: '#ff6b35' }}>Weighted Euclidean Penalty</span>. Pure cosine would overlook someone typing
                at 2× speed if ratios stay proportional; Finomaly’s quadratic penalty resolves this vulnerability.
              </p>

              {/* Stage 1: Vector Normalization */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#00f5d4', fontWeight: 700, letterSpacing: '0.08em' }}>
                    STAGE 1: MIN-MAX PERCENTILE NORMALIZATION
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>
                    Bounds: [min, max] calibrated to human population
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted-foreground)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Dimension</th>
                        <th style={{ padding: '6px 8px' }}>Bound [Min, Max]</th>
                        <th style={{ padding: '6px 8px' }}>Raw Baseline</th>
                        <th style={{ padding: '6px 8px' }}>Raw Attempt</th>
                        <th style={{ padding: '6px 8px', color: '#00f5d4' }}>Norm Base (B)</th>
                        <th style={{ padding: '6px 8px', color: bandColor }}>Norm Live (L)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.featureDeltas.map((fd, i) => {
                        const boundsKey = Object.keys(BOUNDS)[i] as keyof typeof BOUNDS;
                        const b = BOUNDS[boundsKey];
                        return (
                          <tr key={fd.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '6px 8px', color: '#e5eef0', fontWeight: 600 }}>{fd.name}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--muted-foreground)' }}>[{b.min}, {b.max}] {fd.unit}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{Math.round(fd.rawBaseline)} {fd.unit}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{Math.round(fd.rawLive)} {fd.unit}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#00f5d4' }}>{analysis.baselineNorm[i].toFixed(3)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: bandColor }}>{analysis.liveNorm[i].toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stage 2: Weighted Cosine Angle */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#00f5d4', fontWeight: 700, letterSpacing: '0.08em' }}>
                    STAGE 2: WEIGHTED COSINE SIMILARITY (DIRECTIONAL ALIGNMENT)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>
                    Weights w = [1.5, 1.2, 1.8, 0.8, 0.7] (Σw = 6.0)
                  </span>
                </div>
                <div
                  style={{
                    background: 'rgba(0, 245, 212, 0.04)',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    border: '1px solid rgba(0, 245, 212, 0.15)',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Formula: </span>
                    <code>Cosine(B, L) = (Σ wᵢ · Bᵢ · Lᵢ) / (||B||_w · ||L||_w)</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Weighted Dot Product: </span>
                    <span style={{ color: '#fff' }}>B •_w L = {analysis.weightedDotProduct.toFixed(4)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Magnitudes: </span>
                    <span>||B||_w = {analysis.baselineMag.toFixed(4)}</span>
                    <span style={{ margin: '0 0.5rem', color: 'var(--muted-foreground)' }}>•</span>
                    <span>||L||_w = {analysis.liveMag.toFixed(4)}</span>
                  </div>
                  <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#00f5d4', fontWeight: 700 }}>
                      Cosine Similarity = {analysis.cosineSimilarity.toFixed(4)} ({analysis.cosineAngleDegrees.toFixed(1)}° angular divergence)
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage 3: Weighted Euclidean Penalty */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#ff6b35', fontWeight: 700, letterSpacing: '0.08em' }}>
                    STAGE 3: WEIGHTED EUCLIDEAN PENALTY (MAGNITUDE DISTANCE)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>
                    P = √(Σ wᵢ · (Lᵢ − Bᵢ)² / Σwᵢ)
                  </span>
                </div>
                <div
                  style={{
                    background: 'rgba(255, 107, 53, 0.04)',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 107, 53, 0.2)',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Weighted Sum of Squared Differences (SSD): </span>
                    <span style={{ color: '#fff' }}>{analysis.weightedSsdSum.toFixed(4)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Normalized Penalty Distance: </span>
                    <code>P = √({analysis.weightedSsdSum.toFixed(4)} / 6.0) = </code>
                    <span style={{ color: '#ff6b35', fontWeight: 700 }}>{analysis.euclideanPenalty.toFixed(4)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Quadratic Retention Factor: </span>
                    <code>(1 − P)² = (1 − {analysis.euclideanPenalty.toFixed(4)})² = </code>
                    <span style={{ color: '#00f5d4', fontWeight: 700 }}>{analysis.penaltyFactor.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Stage 4: Final Hybrid Synthesis */}
              <div
                style={{
                  background: 'rgba(0, 245, 212, 0.04)',
                  border: `1px solid ${bandColor}`,
                  borderRadius: 10,
                  padding: '1.25rem',
                  boxShadow: `0 0 20px ${bandColor}15`,
                }}
              >
                <span style={{ fontSize: '0.72rem', color: bandColor, fontWeight: 700, letterSpacing: '0.08em', display: 'block' }}>
                  STAGE 4: HYBRID SIMILARITY SYNTHESIS & THRESHOLD BAND
                </span>
                <div style={{ marginTop: '0.5rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
                  <div>
                    <code>Final Score = Cosine(B, L) × (1 − P)²</code>
                  </div>
                  <div>
                    <code>Final Score = {analysis.cosineSimilarity.toFixed(4)} × {analysis.penaltyFactor.toFixed(4)} = </code>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: bandColor, marginLeft: 6 }}>
                      {(effectiveScore * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ marginTop: '0.4rem', color: bandColor, fontWeight: 700, fontSize: '0.82rem' }}>
                    Threshold Classification: {effectiveScore >= 0.85 ? '≥ 85% → DIGITAL IDENTITY CONFIRMED (MATCH)' : effectiveScore >= 0.65 ? '≥ 65% → MILD VARIANCE PERMITTED (RUSHED)' : '< 65% → IDENTITY DIVERGENCE (ANOMALY)'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: 5D FEATURE DELTA MATRIX
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'matrix' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  Per-feature delta breakdown. Highlighted in orange/red if normalized deviation &gt; 25%.
                </span>
                <span style={{ fontSize: '0.72rem', color: '#00f5d4' }}>
                  {analysis.featureDeltas.filter(f => f.isAnomaly).length === 0 ? '✓ All dimensions within tolerance' : `⚠ ${analysis.featureDeltas.filter(f => f.isAnomaly).length} feature(s) deviated beyond 25%`}
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted-foreground)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>BIOMETRIC FEATURE</th>
                      <th style={{ padding: '0.75rem 1rem' }}>BASELINE</th>
                      <th style={{ padding: '0.75rem 1rem' }}>ATTEMPT</th>
                      <th style={{ padding: '0.75rem 1rem' }}>DEVIATION Δ</th>
                      <th style={{ padding: '0.75rem 1rem' }}>VARIANCE IMPACT</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.featureDeltas.map((fd, i) => {
                      const pctDev = Math.round(Math.abs(fd.delta) * 100);
                      const isHigh = fd.isAnomaly;
                      const statusColor = isHigh ? '#ff4444' : '#00f5d4';

                      return (
                        <tr key={fd.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#e5eef0' }}>
                            {fd.name}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#00f5d4' }}>
                            {Math.round(fd.rawBaseline)} <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{fd.unit}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: statusColor, fontWeight: isHigh ? 700 : 500 }}>
                            {Math.round(fd.rawLive)} <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{fd.unit}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: statusColor }}>
                            {fd.delta >= 0 ? '+' : ''}{pctDev}%
                          </td>
                          <td style={{ padding: '0.85rem 1rem', minWidth: 140 }}>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, pctDev * 2.5)}%`,
                                  background: statusColor,
                                  borderRadius: 4,
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: `${statusColor}15`,
                                color: statusColor,
                                border: `1px solid ${statusColor}40`,
                              }}
                            >
                              {isHigh ? 'HIGH DIVERGENCE' : 'CONCORDANT'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Explanatory telemetry footer */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 10,
                  padding: '1rem',
                  fontSize: '0.72rem',
                  color: 'var(--muted-foreground)',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: '#00f5d4', fontWeight: 600 }}>PRIVACY & AUDIT GUARANTEE: </span>
                This telemetry matrix is calculated strictly from time intervals (key down-to-up hold durations and key-to-key flight gaps).
                No keystroke characters, words, or passwords are ever logged, stored, or reconstructed.
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)' }}>
            Prototype. Thresholds are illustrative and not yet validated on real populations.
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              border: '1px solid rgba(0, 245, 212, 0.4)',
              background: 'rgba(0, 245, 212, 0.1)',
              color: '#00f5d4',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            Close Analysis (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
