'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IGNORED_KEYS,
  KeystrokeEvent,
  FlightEvent,
  RawVector,
  NormVector,
  FeatureDelta,
  extractRawVector,
  normaliseVector,
  averageRawVectors,
  computeFeatureDeltas,
  hybridSimilarity,
  scoreToBand,
  wordCount,
  FEATURE_NAMES,
} from './biometrics';
import { enrollSessionApi, verifySessionApi } from '@/lib/apiClient';
import FlatRadarChart from '@/components/FlatRadarChart';
import Footer from '@/components/Footer';

const STORAGE_KEY = 'finomaly_baseline_v4';

const BASELINE_PASSAGES = [
  'The internet was originally developed as a decentralized communication network. Over several decades it evolved from a small academic experiment into a global infrastructure connecting billions of people across every nation on the planet.',
  'Machine learning enables computers to learn patterns from data without being explicitly programmed. Algorithms trained on large datasets can recognize images, translate languages, and detect fraud in financial transactions.',
  'Behavioral biometrics studies uniquely identifying patterns in human activity. Unlike physical biometrics such as fingerprints, behavioral signals like typing rhythm evolve continuously and remain uniquely your own.',
];

const VERIFY_PASSPHRASE = 'behavioral authentication protects accounts where passwords cannot reach';

const MIN_WORDS = 20;

type Step = 'enroll' | 'verify' | 'result';

interface VerificationResult {
  similarity: number;
  liveVector: RawVector;
  liveNorm: NormVector;
  baselineNorm: NormVector;
  featureDeltas: FeatureDelta[];
}

function loadSavedBaseline(): RawVector[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 4 || !Array.isArray(parsed.sessions) || parsed.sessions.length < 1) return null;
    const valid = parsed.sessions.filter((s: any) =>
      s &&
      typeof s.avgHoldTime === 'number' && Number.isFinite(s.avgHoldTime) &&
      typeof s.avgFlightTime === 'number' && Number.isFinite(s.avgFlightTime) &&
      typeof s.wpm === 'number' && Number.isFinite(s.wpm)
    );
    return valid.length >= 1 ? valid : null;
  } catch {
    return null;
  }
}

export default function DemoPage() {
  const [step, setStep] = useState<Step>('enroll');
  const [baselineSessions, setBaselineSessions] = useState<RawVector[]>([]);
  const [enrollPassageIdx, setEnrollPassageIdx] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isPasted, setIsPasted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Tracking keystrokes
  const downMap = useRef(new Map<string, number>());
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const flightsRef = useRef<FlightEvent[]>([]);
  const lastKeyRef = useRef<string | null>(null);
  const lastUpTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check saved baseline on mount
  useEffect(() => {
    const saved = loadSavedBaseline();
    if (saved && saved.length >= 1) {
      setBaselineSessions(saved);
      setStep('verify');
    }
  }, []);

  const resetKeystrokeTracking = () => {
    setTypedText('');
    setIsPasted(false);
    downMap.current.clear();
    keystrokesRef.current = [];
    flightsRef.current = [];
    lastKeyRef.current = null;
    lastUpTimeRef.current = null;
    startTimeRef.current = null;
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.repeat) return;
    const { key } = e;
    if (IGNORED_KEYS.has(key)) return;
    const now = performance.now();
    if (!startTimeRef.current) startTimeRef.current = now;
    downMap.current.set(key, now);

    if (lastUpTimeRef.current !== null && lastKeyRef.current !== null) {
      const flight = Math.max(1, now - lastUpTimeRef.current);
      flightsRef.current.push({
        fromKey: lastKeyRef.current,
        toKey: key,
        flightTime: flight,
      });
    }
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    const { key } = e;
    if (IGNORED_KEYS.has(key)) return;
    const now = performance.now();
    const downTime = downMap.current.get(key);
    if (downTime !== undefined) {
      const hold = Math.max(1, now - downTime);
      keystrokesRef.current.push({ key, downTime, upTime: now, holdTime: hold });
      downMap.current.delete(key);
    }
    lastUpTimeRef.current = now;
    lastKeyRef.current = key;
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    setIsPasted(true);
  }, []);

  // Baseline submission
  const currentWords = wordCount(typedText);
  const canSubmitEnroll = currentWords >= MIN_WORDS;

  const handleEnrollSubmit = () => {
    if (!canSubmitEnroll) return;
    const totalMs = startTimeRef.current ? performance.now() - startTimeRef.current : 3000;
    const vector = extractRawVector({
      keystrokes: keystrokesRef.current,
      flights: flightsRef.current,
      totalDurationMs: totalMs,
      charCount: typedText.length,
    });

    enrollSessionApi(vector).catch(() => {});

    const updated = [...baselineSessions, vector];
    setBaselineSessions(updated);

    if (enrollPassageIdx < 2) {
      setEnrollPassageIdx((i) => i + 1);
      resetKeystrokeTracking();
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 4, sessions: updated }));
      } catch {}
      setStep('verify');
      resetKeystrokeTracking();
    }
  };

  // Verification submission
  const canSubmitVerify = typedText.trim().length >= 25;

  const handleVerifySubmit = async () => {
    if (!canSubmitVerify) return;
    setIsVerifying(true);

    const totalMs = startTimeRef.current ? performance.now() - startTimeRef.current : 3000;
    const liveVector = extractRawVector({
      keystrokes: keystrokesRef.current,
      flights: flightsRef.current,
      totalDurationMs: totalMs,
      charCount: typedText.length,
    });

    const baselineRaw = averageRawVectors(baselineSessions);
    const bNorm = normaliseVector(baselineRaw);
    const lNorm = normaliseVector(liveVector);
    const score = hybridSimilarity(bNorm, lNorm);
    const deltas = computeFeatureDeltas(baselineRaw, liveVector);

    // Call verify API in background
    verifySessionApi(
      liveVector,
      { pasteDetected: isPasted, botSuspected: false },
      undefined,
      baselineSessions
    ).catch(() => {});

    setResult({
      similarity: score,
      liveVector,
      liveNorm: lNorm,
      baselineNorm: bNorm,
      featureDeltas: deltas,
    });
    setIsVerifying(false);
    setStep('result');
  };

  const handleReenroll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setBaselineSessions([]);
    setEnrollPassageIdx(0);
    setResult(null);
    setStep('enroll');
    resetKeystrokeTracking();
  };

  const handleRetryVerify = () => {
    setResult(null);
    setStep('verify');
    resetKeystrokeTracking();
  };

  const baselineRaw = useMemo(() => {
    return baselineSessions.length > 0 ? averageRawVectors(baselineSessions) : null;
  }, [baselineSessions]);

  return (
    <>
      <main className="container" style={{ paddingTop: '40px', paddingBottom: '72px', maxWidth: '880px' }}>
        {/* ── Page Header & Stepper ── */}
        <div style={{ marginBottom: '32px' }}>
          <span className="small text-muted" style={{ display: 'block', marginBottom: '8px' }}>
            Interactive demonstration
          </span>
          <h1 style={{ marginBottom: '24px' }}>Keystroke verification demo</h1>

          {/* Simple clean text stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: step === 'enroll' ? 'var(--accent)' : '#EBE8F3',
                  color: step === 'enroll' ? '#FFFFFF' : 'var(--text)',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                1
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: step === 'enroll' ? 600 : 400, color: step === 'enroll' ? 'var(--text)' : 'var(--text-muted)' }}>
                Enroll
              </span>
            </div>

            <span className="text-muted" style={{ fontSize: '0.875rem' }}>→</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: step === 'verify' ? 'var(--accent)' : '#EBE8F3',
                  color: step === 'verify' ? '#FFFFFF' : 'var(--text)',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                2
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: step === 'verify' ? 600 : 400, color: step === 'verify' ? 'var(--text)' : 'var(--text-muted)' }}>
                Verify
              </span>
            </div>

            <span className="text-muted" style={{ fontSize: '0.875rem' }}>→</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: step === 'result' ? 'var(--accent)' : '#EBE8F3',
                  color: step === 'result' ? '#FFFFFF' : 'var(--text)',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                3
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: step === 'result' ? 600 : 400, color: step === 'result' ? 'var(--text)' : 'var(--text-muted)' }}>
                Result
              </span>
            </div>
          </div>
        </div>

        {/* ── STEP 1: ENROLL ── */}
        {step === 'enroll' && (
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>
                  Passage {enrollPassageIdx + 1} of 3
                </h2>
                <p className="small text-muted">
                  Type the passage below naturally at your usual pace. Avoid copying and pasting.
                </p>
              </div>
              <span className="small text-muted num-tabular">
                Passage {enrollPassageIdx + 1} / 3
              </span>
            </div>

            {/* Prompt text */}
            <div
              style={{
                background: '#FAF9FD',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '14px 16px',
                marginBottom: '16px',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                color: 'var(--text)',
                userSelect: 'none',
              }}
            >
              {BASELINE_PASSAGES[enrollPassageIdx]}
            </div>

            {isPasted && (
              <div style={{ background: 'var(--warning-light)', border: '1px solid #F1D4A6', color: 'var(--warning)', padding: '10px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.8125rem' }}>
                Pasting is disabled because the timing model requires live keystrokes. Please type the passage manually.
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="enroll-textarea" className="small text-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Your input
              </label>
              <textarea
                id="enroll-textarea"
                ref={textareaRef}
                rows={4}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onPaste={handlePaste}
                placeholder="Start typing here..."
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="small text-muted num-tabular">
                {currentWords} / {MIN_WORDS} words required {currentWords >= MIN_WORDS ? '(Ready)' : `(${MIN_WORDS - currentWords} remaining)`}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEnrollSubmit}
                disabled={!canSubmitEnroll}
              >
                {enrollPassageIdx < 2 ? 'Next passage' : 'Finish enrollment'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: VERIFY ── */}
        {step === 'verify' && (
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Verify your identity</h2>
                <p className="small text-muted">
                  Type the standard verification phrase below. Your timing will be compared to your enrolled baseline.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary small"
                onClick={handleReenroll}
                style={{ padding: '4px 10px' }}
              >
                Re-enroll baseline
              </button>
            </div>

            <div
              style={{
                background: '#FAF9FD',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '14px 16px',
                marginBottom: '16px',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                fontWeight: 500,
                color: 'var(--text)',
                userSelect: 'none',
              }}
            >
              {VERIFY_PASSPHRASE}
            </div>

            {isPasted && (
              <div style={{ background: 'var(--warning-light)', border: '1px solid #F1D4A6', color: 'var(--warning)', padding: '10px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.8125rem' }}>
                Pasting is disabled because the timing model requires live keystrokes. Please type the phrase manually.
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="verify-textarea" className="small text-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Your input
              </label>
              <textarea
                id="verify-textarea"
                ref={textareaRef}
                rows={3}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onPaste={handlePaste}
                placeholder="Type the passphrase above..."
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="small text-muted num-tabular">
                {typedText.trim().length} characters typed
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleVerifySubmit}
                disabled={!canSubmitVerify || isVerifying}
              >
                {isVerifying ? 'Comparing...' : 'Run verification'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: RESULT ── */}
        {step === 'result' && result && baselineRaw && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header summary panel */}
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div className="small text-muted" style={{ marginBottom: '4px' }}>Score & classification</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 600 }} className="num-tabular">
                      {(result.similarity * 100).toFixed(1)}%
                    </span>
                    {result.similarity >= 0.85 && (
                      <span className="chip chip-success">Match (Verified)</span>
                    )}
                    {result.similarity >= 0.65 && result.similarity < 0.85 && (
                      <span className="chip chip-warning">Rushed (Mild variance)</span>
                    )}
                    {result.similarity < 0.65 && (
                      <span className="chip chip-danger">Anomaly (Divergence)</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-primary" onClick={handleRetryVerify}>
                    Test again
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleReenroll}>
                    Re-enroll
                  </button>
                  <Link href="/audit" className="btn btn-secondary">
                    View in audit log
                  </Link>
                </div>
              </div>

              <p className="body-text text-muted" style={{ fontSize: '0.875rem', margin: 0 }}>
                {result.similarity >= 0.85
                  ? 'Your live keystroke patterns aligned closely with your enrolled baseline profile.'
                  : result.similarity >= 0.65
                  ? 'Your typing showed noticeable variance from baseline, but remains within permissive bounds.'
                  : 'Substantial divergence detected in dwell times or inter-key transitions.'}
              </p>
            </div>

            {/* Radar chart & Signal metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {/* Flat Radar Chart */}
              <div className="panel" style={{ padding: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '12px' }}>
                  Vector comparison
                </div>
                <FlatRadarChart
                  baselineRaw={baselineRaw}
                  liveRaw={result.liveVector}
                  baselineNorm={result.baselineNorm}
                  liveNorm={result.liveNorm}
                  featureDeltas={result.featureDeltas}
                />
              </div>

              {/* 5 Signals Table */}
              <div className="panel" style={{ padding: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '12px' }}>
                  Signal breakdown
                </div>
                <div className="table-wrapper">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Your value</th>
                        <th>Baseline</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.featureDeltas.map((fd) => {
                        const diffPct = (fd.delta * 100).toFixed(1);
                        return (
                          <tr key={fd.name}>
                            <td style={{ fontWeight: 500 }}>{fd.name}</td>
                            <td className="num-tabular">{Math.round(fd.rawLive)} {fd.unit}</td>
                            <td className="num-tabular text-muted">{Math.round(fd.rawBaseline)} {fd.unit}</td>
                            <td className="num-tabular">
                              <span style={{ color: fd.isAnomaly ? 'var(--danger)' : 'var(--text)' }}>
                                {fd.delta > 0 ? `+${diffPct}%` : `${diffPct}%`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
