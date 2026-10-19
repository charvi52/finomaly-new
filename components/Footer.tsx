export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '28px 0' }}>
      <div className="container" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <div>
          <span>Finomaly · Built by Charvi Naresh, Dolsi Bajaj, and Vasu Sharma.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span>Hackathon prototype</span>
          <a
            href="https://github.com/charvi52/finomaly-new"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
