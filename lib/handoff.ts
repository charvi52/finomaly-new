/**
 * lib/handoff.ts
 * Pure function to detect behavioral handoff / account drift.
 */

export type Verdict = 'Match' | 'Soft Flag' | 'Hard Flag' | string;

export interface HandoffRecord {
  verdict?: Verdict;
  band?: string;
  score?: number;
  timestamp?: string | number | Date;
  created_at?: string;
  reason?: string;
  flags?: {
    pasteDetected?: boolean;
    botSuspected?: boolean;
    zeroVariance?: boolean;
  };
  pasteDetected?: boolean;
  botSuspected?: boolean;
  zeroVariance?: boolean;
}

export type HandoffStatus = 'Insufficient data' | 'Handoff Suspected' | 'Watch' | 'Stable';

export interface HandoffResult {
  status: HandoffStatus;
  reason: string;
}

/**
 * Evaluates whether a single verification record is considered a genuine "Match".
 * Paste-detected and zero-variance (robotic) records count as non-Match,
 * even if marked as 'Match'.
 */
export function isMatchRecord(record: HandoffRecord | null | undefined): boolean {
  if (!record) return false;

  const isPaste = Boolean(record.flags?.pasteDetected || record.pasteDetected);
  const isBotOrZeroVar = Boolean(
    record.flags?.botSuspected ||
    record.flags?.zeroVariance ||
    record.botSuspected ||
    record.zeroVariance
  );

  if (isPaste || isBotOrZeroVar) {
    return false;
  }

  const rawVerdict = record.verdict ?? record.band ?? '';
  const normalized = String(rawVerdict).trim().toLowerCase();

  return normalized === 'match';
}

/**
 * Pure function detectHandoff(records)
 * Evaluates one account's chronological records (oldest -> newest).
 *
 * Rules:
 * - fewer than 5 records -> "Insufficient data"
 * - "Handoff Suspected": at least 2 of the last 3 records are not Match AND among the
 *   up to 5 records before those, at least 3 exist and at least 80% are Match
 * - "Watch": exactly 1 of the last 3 is not Match, OR recent flags without a stable
 *   earlier history
 * - otherwise "Stable"
 * - Paste-detected and zero-variance (robotic) records count as non-Match
 * - The reason must name the counts, e.g. "2 of the last 3 sessions were not Match,
 *   after 4 of 4 earlier sessions matched (100%)."
 */
export function detectHandoff(records: HandoffRecord[] | null | undefined): HandoffResult {
  if (!records || records.length < 5) {
    const count = records ? records.length : 0;
    return {
      status: 'Insufficient data',
      reason: `Insufficient data: only ${count} session${count === 1 ? '' : 's'} recorded (minimum 5 required).`,
    };
  }

  const n = records.length;
  const recentRecords = records.slice(n - 3);
  const recentNonMatch = recentRecords.filter((r) => !isMatchRecord(r)).length;

  // Up to 5 records before the last 3
  const earlierStartIndex = Math.max(0, n - 8);
  const earlierRecords = records.slice(earlierStartIndex, n - 3);
  const earlierCount = earlierRecords.length;
  const earlierMatchCount = earlierRecords.filter((r) => isMatchRecord(r)).length;
  const earlierMatchRatio = earlierCount > 0 ? earlierMatchCount / earlierCount : 0;
  const earlierPercent = Math.round(earlierMatchRatio * 100);

  const hasStableEarlierHistory = earlierCount >= 3 && earlierMatchRatio >= 0.8;

  // 1. Handoff Suspected: at least 2 of the last 3 records are not Match
  // AND among the up to 5 records before those, at least 3 exist and at least 80% are Match
  if (recentNonMatch >= 2 && hasStableEarlierHistory) {
    return {
      status: 'Handoff Suspected',
      reason: `${recentNonMatch} of the last 3 sessions were not Match, after ${earlierMatchCount} of ${earlierCount} earlier sessions matched (${earlierPercent}%).`,
    };
  }

  // 2. Watch: exactly 1 of the last 3 is not Match, OR recent flags without a stable earlier history
  if (recentNonMatch === 1) {
    if (earlierCount > 0) {
      return {
        status: 'Watch',
        reason: `1 of the last 3 sessions was not Match, after ${earlierMatchCount} of ${earlierCount} earlier sessions matched (${earlierPercent}%).`,
      };
    }
    return {
      status: 'Watch',
      reason: '1 of the last 3 sessions was not Match.',
    };
  }

  if (recentNonMatch >= 2 && !hasStableEarlierHistory) {
    return {
      status: 'Watch',
      reason: `${recentNonMatch} of the last 3 sessions were not Match, without a stable earlier baseline (${earlierMatchCount} of ${earlierCount} matched, ${earlierPercent}%).`,
    };
  }

  // 3. Otherwise: Stable (0 of the last 3 are non-Match)
  return {
    status: 'Stable',
    reason: `All of the last 3 sessions matched baseline (${earlierMatchCount} of ${earlierCount} earlier sessions matched, ${earlierPercent}%).`,
  };
}
