import Link from 'next/link';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Finomaly — Behavioral Biometrics Prototype',
  description: 'An auxiliary verification signal based on typing rhythm.',
};

export default function Home() {
  return (
    <>
      <main className="container" style={{ paddingTop: '56px', paddingBottom: '72px' }}>
        {/* ── Two-Column Header ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div>
            <span className="small text-muted" style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>
              Research prototype · Keystroke dynamics
            </span>
            <h1 style={{ marginBottom: '16px', fontSize: '2.1rem' }}>
              Credentials prove someone has access. They cannot prove who is typing.
            </h1>
            <p className="body-text text-muted" style={{ marginBottom: '28px', maxWidth: '520px' }}>
              Finomaly samples dwell time, flight interval, and cadence variance during normal typing. It compares them against an enrolled profile to flag anomalous sessions before transactions execute.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Link href="/demo" className="btn btn-primary">
                Try the demo
              </Link>
              <a href="#how-it-works" className="btn btn-secondary">
                Read how it works
              </a>
            </div>
          </div>

          <div>
            <div className="panel" style={{ padding: '20px', boxShadow: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <span className="small" style={{ fontWeight: 600 }}>Verification result sample</span>
                <span className="chip chip-success">Match · 91%</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#FAF9FD', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div className="small text-muted">Hold time</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }} className="num-tabular">112 ms</div>
                  <div className="small text-muted num-tabular">+2 ms vs base</div>
                </div>
                <div style={{ background: '#FAF9FD', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div className="small text-muted">Flight time</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }} className="num-tabular">88 ms</div>
                  <div className="small text-muted num-tabular">-4 ms vs base</div>
                </div>
                <div style={{ background: '#FAF9FD', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div className="small text-muted">Speed</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }} className="num-tabular">58 wpm</div>
                  <div className="small text-muted num-tabular">+1 wpm vs base</div>
                </div>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5, background: 'var(--bg)', padding: '12px', borderRadius: '4px' }}>
                Cosine similarity 0.96 with Euclidean distance penalty applied. Signal remains well within expected variance.
              </div>
            </div>
          </div>
        </section>

        <hr className="hr" />

        {/* ── How It Works (Numbered List) ── */}
        <section id="how-it-works" style={{ marginBottom: '64px' }}>
          <h2 style={{ marginBottom: '8px' }}>How it works</h2>
          <p className="text-muted" style={{ marginBottom: '28px', maxWidth: '640px' }}>
            The pipeline converts keypress telemetry into an anonymous five-dimensional numerical vector. No text or passwords are saved.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '16px' }}>
              <div className="small text-muted" style={{ fontWeight: 600, marginBottom: '6px' }}>1. Enroll</div>
              <p className="body-text" style={{ fontSize: '0.875rem' }}>
                You type three short passages. The system records key-down and key-up intervals to calculate average hold time, flight time, typing speed, and cadence variances.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '16px' }}>
              <div className="small text-muted" style={{ fontWeight: 600, marginBottom: '6px' }}>2. Compare</div>
              <p className="body-text" style={{ fontSize: '0.875rem' }}>
                During verification, incoming metrics are normalized and compared against your baseline using hybrid similarity: cosine angle adjusted by Euclidean distance penalty.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '16px' }}>
              <div className="small text-muted" style={{ fontWeight: 600, marginBottom: '6px' }}>3. Flag</div>
              <p className="body-text" style={{ fontSize: '0.875rem' }}>
                Scores are placed into one of three bands: match (85–100%), permitted with mild variance (65–84%), or identity divergence (&lt;65%). Anomalies create an immutable audit record.
              </p>
            </div>
          </div>
        </section>

        <hr className="hr" />

        {/* ── What it does NOT do ── */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ marginBottom: '8px' }}>What it does not do</h2>
          <p className="text-muted" style={{ marginBottom: '20px' }}>
            Clear boundaries on scope and intended operation.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>Does not store typed text</div>
              <p className="small text-muted">
                Keydown events calculate timing differences in milliseconds. The characters, words, and passwords themselves are discarded immediately in memory.
              </p>
            </div>

            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>Does not replace passwords or MFA</div>
              <p className="small text-muted">
                Keystroke biometrics is designed as an auxiliary, continuous risk score, not a standalone gatekeeper.
              </p>
            </div>

            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>Does not run without consent</div>
              <p className="small text-muted">
                Timing listeners attach strictly to designated verification input fields. There is no passive background keylogging across other browser tabs or windows.
              </p>
            </div>

            <div className="panel" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>Not a commercial product</div>
              <p className="small text-muted">
                This is an exploratory hackathon prototype. Score thresholds are illustrative and have not been benchmarked on large demographic datasets.
              </p>
            </div>
          </div>
        </section>

        <hr className="hr" />

        {/* ── FAQ ── */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ marginBottom: '20px' }}>Frequently asked questions</h2>

          <div style={{ borderTop: '1px solid var(--border)' }}>
            <details className="faq-disclosure">
              <summary>
                <span>How does keystroke verification differ from traditional credentials?</span>
                <span className="small text-muted">+</span>
              </summary>
              <div className="faq-body">
                Passwords, session tokens, and OTPs verify credential possession. They cannot determine if the authorized account holder is the person physically operating the keyboard. Keystroke dynamics analyzes the neuromuscular timing habits of how you type.
              </div>
            </details>

            <details className="faq-disclosure">
              <summary>
                <span>What happens if someone types faster or has an injured finger?</span>
                <span className="small text-muted">+</span>
              </summary>
              <div className="faq-body">
                Human typing rhythm has natural variance. The prototype uses a tolerance band between 65% and 84% (labeled Rushed / Mild Variance) which permits access without hard blocking. Scores below 65% indicate substantial deviation across multiple dimensions.
              </div>
            </details>

            <details className="faq-disclosure">
              <summary>
                <span>Where is the baseline saved?</span>
                <span className="small text-muted">+</span>
              </summary>
              <div className="faq-body">
                In this demo prototype, your enrolled baseline is stored in your browser's local storage so you can test verification across page refreshes. You can clear or re-enroll at any time.
              </div>
            </details>

            <details className="faq-disclosure">
              <summary>
                <span>How does the Imposter Challenge work?</span>
                <span className="small text-muted">+</span>
              </summary>
              <div className="faq-body">
                You enroll Person A with three passages, then invite Person B to type the verification passphrase using Person A's credentials. The score reflects whether Person B's motor cadence matches Person A's baseline.
              </div>
            </details>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
