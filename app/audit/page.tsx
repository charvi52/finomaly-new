'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { getDemoUserId } from '@/lib/apiClient';
import { detectHandoff, isMatchRecord, HandoffStatus } from '@/lib/handoff';
import Footer from '@/components/Footer';

export interface AuditRecord {
  id: string;
  user_id: string;
  score: number;
  band: string;
  features?: {
    liveVector?: number[];
    baselineVector?: number[];
  };
  flags?: {
    pasteDetected?: boolean;
    botSuspected?: boolean;
    zeroVariance?: boolean;
  };
  created_at: string;
  handoffStatus?: string | null;
  handoffReason?: string | null;
}

interface AccountHandoffSummary {
  userId: string;
  status: HandoffStatus | 'Status unavailable';
  reason: string;
  timeline: Array<{
    id: string;
    verdict: string;
    score: number;
    color: string;
    timeFormatted: string;
    flagsText?: string;
  }>;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [activeReasonAccount, setActiveReasonAccount] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [bandFilter, setBandFilter] = useState<'all' | 'match' | 'rushed' | 'anomaly'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Scope filter: 'all' (default, displays all demo audit logs) vs 'mine' (only current browser session)
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  const fetchAuditLogs = useCallback(async (currentScope = scope) => {
    setLoading(true);
    setError(null);

    try {
      const currentId = getDemoUserId();
      const queryUser = currentScope === 'mine' ? currentId : 'all';

      const res = await fetch(`/api/audit?userId=${encodeURIComponent(queryUser)}`, {
        headers: {
          'x-finomaly-client': 'web',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(msg);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const currentId = getDemoUserId();
    setUserId(currentId);
    fetchAuditLogs('all');
  }, []);

  // Format time (local + relative)
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const local = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      let relative = '';
      if (diffMins < 1) relative = 'just now';
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else {
        const diffHours = Math.floor(diffMins / 60);
        relative = `${diffHours}h ago`;
      }
      return { local, relative };
    } catch {
      return { local: '—', relative: '—' };
    }
  };

  // Compute Handoff Status per account
  const accountsHandoffSummaries = useMemo<AccountHandoffSummary[]>(() => {
    if (error && logs.length === 0) {
      return [
        {
          userId: userId || 'current_account',
          status: 'Status unavailable',
          reason: 'Audit data unavailable (database connection offline or fallback mode).',
          timeline: [],
        },
      ];
    }

    if (logs.length === 0) {
      return [];
    }

    // Group logs by account
    const grouped = new Map<string, AuditRecord[]>();
    for (const log of logs) {
      const uid = log.user_id || 'unknown';
      const list = grouped.get(uid);
      if (list) {
        list.push(log);
      } else {
        grouped.set(uid, [log]);
      }
    }

    const summaries: AccountHandoffSummary[] = [];

    grouped.forEach((accountLogs, uid) => {
      try {
        // Sort oldest to newest
        const sorted = [...accountLogs].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Detect handoff status using pure detectHandoff function
        const handoffResult = detectHandoff(
          sorted.map((r) => {
            let verdict = 'Match';
            const b = (r.band || '').toLowerCase();
            if (b === 'anomaly') verdict = 'Hard Flag';
            else if (b === 'rushed') verdict = 'Soft Flag';
            else if (b === 'match') verdict = 'Match';
            else verdict = r.band || 'Match';

            return {
              verdict,
              band: r.band,
              score: r.score,
              timestamp: r.created_at,
              created_at: r.created_at,
              flags: r.flags,
              pasteDetected: Boolean(r.flags?.pasteDetected),
              botSuspected: Boolean(r.flags?.botSuspected),
            };
          })
        );

        // Last 10 records for the timeline dots
        const last10 = sorted.slice(-10);
        const timeline = last10.map((r) => {
          const isMatch = isMatchRecord({
            verdict: r.band,
            flags: r.flags,
          });

          const isRushed = (r.band || '').toLowerCase() === 'rushed';
          let color = '#2e6b3e'; // Green for Match
          let verdict = 'Match';

          if (!isMatch) {
            if (isRushed && !r.flags?.pasteDetected && !r.flags?.botSuspected) {
              color = '#b8741a'; // Amber for Soft Flag / Rushed
              verdict = 'Soft Flag (Rushed)';
            } else {
              color = '#b93826'; // Red for Hard Flag / Anomaly / Paste / Bot
              verdict = r.flags?.pasteDetected
                ? 'Hard Flag (Paste)'
                : r.flags?.botSuspected
                ? 'Hard Flag (Robotic)'
                : 'Hard Flag (Anomaly)';
            }
          }

          const { local } = formatTime(r.created_at);
          const flagsList: string[] = [];
          if (r.flags?.pasteDetected) flagsList.push('Paste');
          if (r.flags?.botSuspected) flagsList.push('Robotic');

          return {
            id: r.id,
            verdict,
            score: r.score,
            color,
            timeFormatted: local,
            flagsText: flagsList.length > 0 ? flagsList.join(', ') : undefined,
          };
        });

        summaries.push({
          userId: uid,
          status: handoffResult.status,
          reason: handoffResult.reason,
          timeline,
        });
      } catch {
        summaries.push({
          userId: uid,
          status: 'Status unavailable',
          reason: 'Unable to evaluate account drift status.',
          timeline: [],
        });
      }
    });

    return summaries;
  }, [logs, error, userId]);

  // Filtered and sorted logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Filter by band
    if (bandFilter !== 'all') {
      result = result.filter((r) => r.band?.toLowerCase() === bandFilter);
    }

    // Search query (matches ID, user_id, band)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.id?.toLowerCase().includes(q) ||
          r.user_id?.toLowerCase().includes(q) ||
          r.band?.toLowerCase().includes(q)
      );
    }

    // Sort by timestamp
    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [logs, bandFilter, searchQuery, sortOrder]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderBandChip = (band: string) => {
    const b = band?.toLowerCase();
    if (b === 'match') {
      return <span className="chip chip-success">Match</span>;
    }
    if (b === 'rushed') {
      return <span className="chip chip-warning">Rushed</span>;
    }
    return <span className="chip chip-danger">Anomaly</span>;
  };

  const renderHandoffBadge = (status: HandoffStatus | 'Status unavailable' | string | null | undefined) => {
    if (status === 'Stable') {
      return (
        <span
          className="chip chip-success"
          style={{ fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.02em' }}
        >
          ● Stable
        </span>
      );
    }
    if (status === 'Watch') {
      return (
        <span
          className="chip chip-warning"
          style={{ fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.02em' }}
        >
          ▲ Watch
        </span>
      );
    }
    if (status === 'Handoff Suspected') {
      return (
        <span
          className="chip chip-danger"
          style={{ fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.02em' }}
        >
          ⚠ Handoff Suspected
        </span>
      );
    }
    if (status === 'Insufficient data') {
      return (
        <span
          className="chip chip-neutral"
          style={{ fontWeight: 500, fontSize: '0.72rem', color: 'var(--text-muted)' }}
        >
          ○ Insufficient data
        </span>
      );
    }
    return (
      <span
        className="chip chip-neutral"
        style={{ fontWeight: 500, fontSize: '0.72rem', color: 'var(--text-muted)' }}
      >
        — Status unavailable
      </span>
    );
  };

  return (
    <>
      <main id="main-content" className="container audit-main" style={{ paddingTop: '40px', paddingBottom: '72px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <span className="small text-muted" style={{ display: 'block', marginBottom: '6px' }}>
              Operations & compliance
            </span>
            <h1 style={{ marginBottom: '6px' }}>Audit log</h1>
            <p className="body-text text-muted">
              Live telemetry records captured from demo and challenge verification sessions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px' }}>
              <button
                type="button"
                className={`btn small ${scope === 'all' ? 'btn-primary' : 'btn-text'}`}
                style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                onClick={() => {
                  setScope('all');
                  fetchAuditLogs('all');
                }}
              >
                All sessions
              </button>
              <button
                type="button"
                className={`btn small ${scope === 'mine' ? 'btn-primary' : 'btn-text'}`}
                style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                onClick={() => {
                  setScope('mine');
                  fetchAuditLogs('mine');
                }}
              >
                My session only
              </button>
            </div>
            <button
              type="button"
              className="btn btn-secondary small"
              onClick={() => fetchAuditLogs(scope)}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* TASK 1: Handoff Drift Status Section */}
        <section
          aria-label="Account Handoff Drift Alerts"
          style={{
            marginBottom: '28px',
            padding: '20px 24px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="eyebrow" style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                Continuous behavioral monitor
              </div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Handoff drift detection</h2>
            </div>
            <span className="small text-muted">
              Evaluates latest 3 sessions against baseline history
            </span>
          </div>

          {/* State: Data unavailable / DB down */}
          {(error || (!loading && logs.length === 0)) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '14px 18px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderHandoffBadge('Status unavailable')}
                <span className="small text-muted" style={{ color: 'var(--text-muted)' }}>
                  {error
                    ? 'Status unavailable: Could not reach telemetry database.'
                    : 'Status unavailable: No sessions recorded yet. Complete a typing lab to start monitoring.'}
                </span>
              </div>
              <Link href="/demo" className="btn btn-secondary small" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                Run demo
              </Link>
            </div>
          )}

          {/* Account cards with Status Badge & 10-Verdicts Timeline */}
          {!loading && accountsHandoffSummaries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {accountsHandoffSummaries.map((account) => {
                const isSelected = activeReasonAccount === account.userId;
                const shortUser = account.userId.startsWith('ephemeral')
                  ? `Demo account (${account.userId.slice(0, 14)}...)`
                  : `Account: ${account.userId}`;

                return (
                  <div
                    key={account.userId}
                    style={{
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--accent-light)' : 'var(--bg)',
                      padding: '16px 20px',
                      transition: 'background 0.15s, border-color 0.15s',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      setActiveReasonAccount(isSelected ? null : account.userId)
                    }
                    title={account.reason}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      {/* Left: Account ID & Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }} className="mono-id">
                          {shortUser}
                        </span>
                        {renderHandoffBadge(account.status)}
                      </div>

                      {/* Right: Last 10 Verdicts Timeline Dots */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReasonAccount(isSelected ? null : account.userId);
                        }}
                      >
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Last {account.timeline.length} verdicts:
                        </span>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                          }}
                          aria-label="Timeline of last 10 session verdicts"
                        >
                          {account.timeline.length === 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              No history
                            </span>
                          )}
                          {account.timeline.map((dot, idx) => (
                            <button
                              key={dot.id || idx}
                              type="button"
                              aria-label={`${dot.verdict} session on ${dot.timeFormatted}`}
                              title={`${dot.verdict} (${(dot.score * 100).toFixed(0)}%) - ${dot.timeFormatted}\n${account.reason}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReasonAccount(account.userId);
                              }}
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: dot.color,
                                border: '1px solid rgba(255,255,255,0.18)',
                                padding: 0,
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'transform 0.12s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* One-line reason banner */}
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '0.82rem',
                        color: 'var(--text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <strong style={{ fontWeight: 600, color: 'var(--text)', marginRight: '6px' }}>Diagnosis:</strong>
                        <span style={{ color: 'var(--text)', opacity: 0.9 }}>{account.reason}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent)', flexShrink: 0 }}>
                        {isSelected ? 'Tap to collapse' : 'Tap to expand'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '600px' }}>
            <input
              type="search"
              placeholder="Search session ID or user..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ maxWidth: '280px' }}
            />

            <select
              value={bandFilter}
              onChange={(e) => {
                setBandFilter(e.target.value as 'all' | 'match' | 'rushed' | 'anomaly');
                setCurrentPage(1);
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All bands</option>
              <option value="match">Match</option>
              <option value="rushed">Rushed</option>
              <option value="anomaly">Anomaly</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary small"
              onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            >
              Time: {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            </button>
          </div>

          <div className="small text-muted num-tabular">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'} found
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ background: 'var(--danger-light)', border: '1px solid #654139', color: 'var(--danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.875rem' }}>
            Could not fetch audit records: {error}. Check backend connection or try refreshing.
          </div>
        )}

        {/* Main Content Layout (Table + Side Panel) */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedRecord ? '1fr 340px' : '1fr', gap: '20px', alignItems: 'start' }}>
          {/* Operations Table */}
          <div className="table-wrapper">
            <table className="fin-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Time</th>
                  <th>Session ID</th>
                  <th>Score</th>
                  <th>Band</th>
                  <th>Flags</th>
                  <th>Handoff Alert</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading skeleton state */}
                {loading && (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        <td><div className="skeleton" style={{ height: '16px', width: '120px' }} /></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '90px' }} /></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '50px' }} /></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '60px' }} /></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '40px' }} /></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '80px' }} /></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '50px' }} /></td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Empty state (No fake sample rows) */}
                {!loading && filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
                      <p className="text-muted" style={{ marginBottom: '12px' }}>
                        No attempts yet. Run the demo to create one.
                      </p>
                      <Link href="/demo" className="btn btn-primary small">
                        Go to demo
                      </Link>
                    </td>
                  </tr>
                )}

                {/* Real Log rows */}
                {!loading &&
                  paginatedLogs.map((row) => {
                    const { local, relative } = formatTime(row.created_at);
                    const isSelected = selectedRecord?.id === row.id;
                    const flagsCount = (row.flags?.pasteDetected ? 1 : 0) + (row.flags?.botSuspected ? 1 : 0);
                    const shortId = row.id ? row.id.slice(0, 8) : '—';

                    return (
                      <tr
                        key={row.id}
                        className={`clickable ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedRecord(row)}
                      >
                        <td>
                          <span className="num-tabular" style={{ fontWeight: 500 }}>{local}</span>
                          <span className="small text-muted" style={{ display: 'block' }}>{relative}</span>
                        </td>
                        <td>
                          <span className="mono-id">{shortId}</span>
                        </td>
                        <td>
                          <span className="num-tabular" style={{ fontWeight: 600 }}>
                            {(row.score * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td>{renderBandChip(row.band)}</td>
                        <td>
                          {flagsCount > 0 ? (
                            <span className="chip chip-danger">{flagsCount} flagged</span>
                          ) : (
                            <span className="text-muted small">None</span>
                          )}
                        </td>
                        <td>
                          {renderHandoffBadge(row.handoffStatus)}
                        </td>
                        <td>
                          <span className="small text-muted">
                            {row.user_id?.startsWith('ephemeral') ? 'Demo' : 'API'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Side Panel for Selected Record */}
          {selectedRecord && (
            <div className="panel" style={{ padding: '20px', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Record details</span>
                <button
                  type="button"
                  className="btn btn-text small"
                  onClick={() => setSelectedRecord(null)}
                  style={{ padding: '0 4px', color: 'var(--text-muted)' }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.8125rem' }}>
                <div>
                  <div className="text-muted small">Session ID</div>
                  <div className="mono-id" style={{ wordBreak: 'break-all' }}>{selectedRecord.id}</div>
                </div>

                <div>
                  <div className="text-muted small">User ID</div>
                  <div className="mono-id">{selectedRecord.user_id}</div>
                </div>

                <div>
                  <div className="text-muted small">Recorded at</div>
                  <div>{new Date(selectedRecord.created_at).toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-muted small">Score & band</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }} className="num-tabular">
                      {(selectedRecord.score * 100).toFixed(1)}%
                    </span>
                    {renderBandChip(selectedRecord.band)}
                  </div>
                </div>

                <div>
                  <div className="text-muted small">Account Handoff Status</div>
                  <div style={{ marginTop: '4px' }}>
                    {renderHandoffBadge(selectedRecord.handoffStatus)}
                    {selectedRecord.handoffReason && (
                      <p className="small text-muted" style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                        {selectedRecord.handoffReason}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-muted small">Security flags</div>
                  <div style={{ marginTop: '4px' }}>
                    {selectedRecord.flags?.pasteDetected && (
                      <div className="chip chip-danger" style={{ marginBottom: '4px' }}>Paste detected</div>
                    )}
                    {selectedRecord.flags?.botSuspected && (
                      <div className="chip chip-danger">Bot pattern suspected</div>
                    )}
                    {!selectedRecord.flags?.pasteDetected && !selectedRecord.flags?.botSuspected && (
                      <div className="text-muted">No security flags triggered</div>
                    )}
                  </div>
                </div>

                {selectedRecord.features?.liveVector && (
                  <div>
                    <div className="text-muted small" style={{ marginBottom: '6px' }}>5D Feature vector</div>
                    <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      [{selectedRecord.features.liveVector.map((v) => Math.round(v)).join(', ')}]
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pagination bar */}
        {filteredLogs.length > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span className="small text-muted num-tabular">
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary small"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary small"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
