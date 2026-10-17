'use client';

import { useCallback, useMemo, useState } from 'react';
import BaselineSession from './BaselineSession';
import LoginSession from './LoginSession';
import ResultsView from './ResultsView';
import IdentitySignatureCard from './IdentitySignatureCard';
import {
  RawVector,
  NormVector,
  FeatureDelta,
  KeystrokeEvent,
  averageRawVectors,
  generatePlainLanguageReadout,
} from './biometrics';

const LOGO_PATHS = [
  'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
  'M14 13.12c0 2.38 0 6.38-1 8.88',
  'M17.29 21.02c.12-.6.43-2.3.5-3.02',
  'M2 12a10 10 0 0 1 18-6',
  'M2 16h.01',
  'M21.8 16c.2-2 .131-5.354 0-6',
  'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2',
  'M8.65 22c.21-.66.45-1.32.57-2',
  'M9 6.8a6 6 0 0 1 9 5.2v2',
];

type Phase = 'intro' | 'baseline' | 'login' | 'results';

interface AuthResult {
  liveVector: RawVector;
  liveNorm: NormVector;
  baselineNorm: NormVector;
  similarity: number;
  perSession: number[];
  featureDeltas: FeatureDelta[];
  liveKeystrokes: KeystrokeEvent[];
  mode?: 'server' | 'local';
}

export default function ImposterChallengeModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [baselineSessions, setBaselineSessions] = useState<RawVector[]>([]);
  const [result, setResult] = useState<AuthResult | null>(null);

  const [showFullAnalytics, setShowFullAnalytics] = useState(false);

  const personAVector = useMemo(() => {
    return baselineSessions.length > 0 ? averageRawVectors(baselineSessions) : null;
  }, [baselineSessions]);

  const readouts = useMemo(() => {
    if (!personAVector || !result) return [];
    return generatePlainLanguageReadout(personAVector, result.liveVector, result.featureDeltas, result.similarity);
  }, [personAVector, result]);

  const close = () => {
    setOpen(false);
    setPhase('intro');
    setBaselineSessions([]);
    setResult(null);
    setShowFullAnalytics(false);
  };

  const onBaselineComplete = useCallback((sessions: RawVector[]) => {
    // Intentionally NOT saving to localStorage so it's one-time use
    setBaselineSessions(sessions);
    setTimeout(() => setPhase('login'), 300);
  }, []);

  const onAuthResult = useCallback((r: AuthResult) => {
    setResult(r);
    setPhase('results');
  }, []);

  const onReenroll = useCallback(() => {
    close();
  }, []);

  const onRetry = useCallback(() => {
    close();
  }, []);

  const stepNum = phase === 'intro' ? 0 : phase === 'baseline' ? 1 : phase === 'login' ? 2 : 3;
  const stepLabel = phase === 'intro' ? 'Instructions' : phase === 'baseline' ? 'Person A: Physical Baseline' : phase === 'login' ? 'Person B: Live Challenge' : 'Identity Translation';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.625rem 1.25rem', borderRadius: 8,
          border: '1px solid rgba(255,107,53,0.5)', background: 'rgba(255,107,53,0.1)',
          color: '#ff6b35', cursor: 'pointer', fontSize: '0.875rem',
          fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', transition: 'all 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,53,0.18)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,107,53,0.1)')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Imposter Challenge
      </button>

      {open && (
        <div className="hud-overlay" onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="hud-panel fade-in" style={{ maxWidth: 860 }}>
            <div className="hud-header" style={{ borderBottomColor: phase === 'intro' || phase === 'login' ? 'rgba(255,107,53,0.15)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={phase === 'login' ? '#ff6b35' : 'var(--primary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {LOGO_PATHS.map((d, i) => <path key={i} d={d} />)}
                </svg>
                <div>
                  <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 600, color: phase === 'login' ? '#ff6b35' : undefined }}>
                    finomaly<span style={{ color: phase === 'login' ? '#ff6b35' : 'var(--primary)' }}>.</span> challenge
                  </p>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                    STEP {stepNum}/3 — {stepLabel.toUpperCase()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{
                      width: 24, height: 4, borderRadius: 9999,
                      background: n <= stepNum ? (phase === 'login' ? '#ff6b35' : 'var(--primary)') : 'var(--border)',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <button onClick={close} style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live Backend Connection Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 14px',
              background: 'rgba(0, 245, 212, 0.04)',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.72rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--muted-foreground)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#00f5d4' }}>
                <span className="status-dot" style={{ width: 6, height: 6 }} />
                TRANSLATION ENGINE ONLINE // 30-SEC DEMO FLOW
              </span>
              <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem' }}>
                PHYSICAL ⇄ DIGITAL
              </span>
            </div>

            {phase === 'intro' && (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }} className="fade-in">
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,107,53,0.1)', border: '2px solid rgba(255,107,53,0.3)', margin: '0 auto 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', color: '#ff6b35', margin: '0 0 0.5rem', fontWeight: 700 }}>
                  THE PHYSICAL VS DIGITAL GAP CHALLENGE
                </p>
                <p style={{ fontSize: '0.88rem', color: 'var(--muted-foreground)', margin: '0 0 1.5rem', lineHeight: 1.6, textAlign: 'left' }}>
                  Digital systems only see keystroke characters—they are blind to the human body behind the screen. Watch Finomaly translate two different humans typing the exact same text into two distinct digital signatures:
                </p>
                <ol style={{ fontSize: '0.85rem', color: 'var(--foreground)', margin: '0 0 1.5rem', lineHeight: 1.7, textAlign: 'left', paddingLeft: '1.25rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Person A (The Owner)</strong> types the baseline passage to register their natural rhythm.</li>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Person B (The Challenger)</strong> sits at the same keyboard and types the exact same phrase.</li>
                  <li style={{ marginBottom: '0.5rem' }}>Finomaly compares both digital identity cards side-by-side in real time.</li>
                </ol>
                <button
                  onClick={() => setPhase('baseline')}
                  style={{
                    padding: '0.875rem 1.5rem', borderRadius: 8,
                    border: '1px solid #ff6b35',
                    background: 'rgba(255,107,53,0.1)',
                    color: '#ff6b35',
                    cursor: 'pointer', width: '100%',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                >
                  Start Challenge (Person A) →
                </button>
              </div>
            )}
            
            {phase === 'baseline' && <BaselineSession onComplete={onBaselineComplete} />}
            {phase === 'login' && (
              <div className="fade-in">
                <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(255,107,53,0.1)', borderBottom: '1px solid rgba(255,107,53,0.2)' }}>
                  <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#ff6b35', fontWeight: 700 }}>
                    PERSON B: YOUR TURN TO TYPE
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--foreground)' }}>
                    Type the exact same passphrase on this keyboard. Notice how your natural motor cadence differs.
                  </p>
                </div>
                <LoginSession
                  baselineSessions={baselineSessions}
                  onResult={onAuthResult}
                  onReenroll={onReenroll}
                />
              </div>
            )}
            {phase === 'results' && result && personAVector && (
              <div className="fade-in" style={{ padding: '1.5rem' }}>
                {/* ── CENTERPIECE BANNER ── */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', marginBottom: '0.6rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6b35' }} />
                    <span style={{ fontSize: '0.64rem', fontFamily: 'JetBrains Mono, monospace', color: '#ff6b35', fontWeight: 700, letterSpacing: '0.1em' }}>
                      BRIDGE THE GAP // IDENTITY SIGNATURE PROOF
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', margin: '4px 0 6px', letterSpacing: '-0.02em' }}>
                    Same words. Two people. Two digital identities.
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted-foreground)', maxWidth: 580, marginInline: 'auto', lineHeight: 1.5 }}>
                    Both people entered the identical passphrase. While digital passwords see no difference, Finomaly translated their distinct physical motor habits into two unique digital identity cards.
                  </p>
                </div>

                {/* ── SIDE-BY-SIDE IDENTITY SIGNATURE CARDS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <IdentitySignatureCard
                    label="Person A (Enrolled)"
                    sublabel="Physical Origin Baseline"
                    rawVector={personAVector}
                    accentColor="#00f5d4"
                    highlighted={true}
                  />
                  <IdentitySignatureCard
                    label="Person B (Challenger)"
                    sublabel="Challenger Motor Pattern"
                    rawVector={result.liveVector}
                    accentColor="#ff6b35"
                    highlighted={true}
                  />
                </div>

                {/* ── TRANSLATION DELTA & PLAIN-LANGUAGE READOUT ── */}
                <div
                  style={{
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.4)',
                    border: result.similarity >= 0.85 ? '1px solid rgba(0,245,212,0.4)' : '1px solid rgba(255,107,53,0.4)',
                    padding: '0.85rem 1.15rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: result.similarity >= 0.85 ? '#00f5d4' : '#ff6b35', fontWeight: 700, letterSpacing: '0.08em' }}>
                      TRANSLATION READOUT // PHYSICAL-TO-DIGITAL
                    </span>
                    <span style={{ fontSize: '0.9rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: result.similarity >= 0.85 ? '#00f5d4' : '#ff6b35' }}>
                      SIMILARITY SCORE: {Math.round(result.similarity * 100)}% ({result.similarity >= 0.85 ? 'MATCH' : 'ANOMALY DETECTED'})
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {readouts.map((text, idx) => (
                      <p key={idx} style={{ margin: 0, fontSize: '0.78rem', color: '#d1e5e8', lineHeight: 1.45, fontFamily: 'JetBrains Mono, monospace' }}>
                        ▸ {text}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Toggle full analytics */}
                {showFullAnalytics && (
                  <div style={{ marginBottom: '1.25rem', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <ResultsView
                      similarity={result.similarity}
                      liveVector={result.liveVector}
                      liveNorm={result.liveNorm}
                      baselineNorm={result.baselineNorm}
                      baselineSessions={baselineSessions}
                      featureDeltas={result.featureDeltas}
                      perSession={result.perSession}
                      liveKeystrokes={result.liveKeystrokes}
                      mode={result.mode}
                      onRetry={onRetry}
                      onClose={close}
                    />
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowFullAnalytics(prev => !prev)}
                    style={{
                      padding: '0.65rem 1.25rem', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--foreground)', cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600,
                    }}
                  >
                    {showFullAnalytics ? 'Hide Detailed Graphs' : 'View Full Metric Breakdown ▾'}
                  </button>
                  <button
                    onClick={close}
                    style={{
                      padding: '0.65rem 1.5rem', borderRadius: 8,
                      border: '1px solid rgba(255,107,53,0.5)', background: 'rgba(255,107,53,0.1)',
                      color: '#ff6b35', cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 700,
                    }}
                  >
                    Finish Challenge
                  </button>
                </div>

                {/* On-screen note */}
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.66rem', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.35)' }}>
                    Prototype. Thresholds are illustrative and not yet validated on real populations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
