'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/demo', label: 'Demo' },
    { href: '/challenge', label: 'Imposter challenge' },
    { href: '/audit', label: 'Audit log' },
  ];

  return (
    <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
            Finomaly
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    color: isActive ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    padding: '17px 0 15px',
                    transition: 'color 150ms ease, border-color 150ms ease',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <a
            href="https://github.com/charvi52/finomaly-new"
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: 'none',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
