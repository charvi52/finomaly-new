'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Captured by Next.js Error Boundary:', error);
  }, [error]);

  const handleClearAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    reset();
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080c0d',
        color: '#f0f4f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          width: '100%',
          background: 'rgba(12, 17, 20, 0.95)',
          border: '1px solid rgba(255, 107, 53, 0.4)',
          borderRadius: 12,
          padding: '2rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(255,107,53,0.1)',
            border: '2px solid #ff6b35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: '#ff6b35',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 2 22 22 22 12 2" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 style={{ fontSize: '1.2rem', color: '#ff6b35', margin: '0 0 0.5rem', fontWeight: 700 }}>
          CLIENT RUNTIME RECOVERY
        </h2>

        <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
          A client-side state divergence occurred. Click below to clear stored baseline cache and reload the clean state.
        </p>

        {error?.message && (
          <div
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '0.75rem 1rem',
              fontSize: '0.75rem',
              color: '#ff9f43',
              textAlign: 'left',
              marginBottom: '1.5rem',
              overflowX: 'auto',
              wordBreak: 'break-word',
            }}
          >
            <strong>Error:</strong> {error.message}
            {error.digest && <div style={{ fontSize: '0.65rem', color: '#6b7e83', marginTop: 4 }}>Digest: {error.digest}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={handleClearAndReset}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              border: '1px solid #00f5d4',
              background: 'rgba(0, 245, 212, 0.1)',
              color: '#00f5d4',
              cursor: 'pointer',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.82rem',
              transition: 'all 0.2s',
            }}
          >
            Clear Cache &amp; Reload →
          </button>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.82rem',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
