import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectHandoff, isMatchRecord } from '../lib/handoff.ts';
import type { HandoffRecord } from '../lib/handoff.ts';

describe('detectHandoff', () => {
  // Helper to make records
  const rec = (
    verdict: string,
    overrides?: Partial<HandoffRecord>
  ): HandoffRecord => ({
    verdict,
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  it('1. Fewer than 5 records (4 records) returns "Insufficient data"', () => {
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Soft Flag'),
      rec('Match'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Insufficient data');
    assert.match(res.reason, /only 4 sessions recorded/i);
  });

  it('2. 5 Match + 2 flags returns "Handoff Suspected" with detailed count reason', () => {
    // 5 Match + 2 flags = 7 records total
    // Last 3: Match, Hard Flag, Soft Flag (2 of 3 not Match)
    // Earlier before last 3: 4 records (Match, Match, Match, Match) -> 4 of 4 matched (100% >= 80% and 4 >= 3)
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Hard Flag'),
      rec('Soft Flag'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Handoff Suspected');
    assert.equal(
      res.reason,
      '2 of the last 3 sessions were not Match, after 4 of 4 earlier sessions matched (100%).'
    );
  });

  it('3. Single flag after stable history returns "Watch"', () => {
    // 5 Match, then 1 Flag, then Match -> last 3 has 1 Flag
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Soft Flag'),
      rec('Match'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Watch');
    assert.match(res.reason, /1 of the last 3 sessions was not Match/i);
  });

  it('4. All Match records returns "Stable"', () => {
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Stable');
    assert.match(res.reason, /All of the last 3 sessions matched baseline/i);
  });

  it('5. Recent flags without stable history (< 3 earlier records) returns "Watch"', () => {
    // 5 records total: 2 Match, then 2 flags, then Match
    // Last 3: Flag, Flag, Match (2 flags)
    // Earlier: only 2 records (Match, Match) -> earlierCount is 2 (< 3 required for Handoff Suspected)
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Hard Flag'),
      rec('Soft Flag'),
      rec('Match'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Watch');
    assert.match(res.reason, /without a stable earlier baseline/i);
  });

  it('6. Recent flags with noisy baseline (< 80% match in earlier records) returns "Watch"', () => {
    // 6 records: Soft Flag, Match, Soft Flag, Match, Hard Flag, Hard Flag
    // Last 3: Match, Hard Flag, Hard Flag -> 2 non-match
    // Earlier 3: Soft Flag, Match, Soft Flag -> 1 of 3 match = 33% (< 80%)
    const records: HandoffRecord[] = [
      rec('Soft Flag'),
      rec('Match'),
      rec('Soft Flag'),
      rec('Match'),
      rec('Hard Flag'),
      rec('Hard Flag'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Watch');
    assert.match(res.reason, /without a stable earlier baseline/i);
  });

  it('7. Paste-detected record counts as non-Match even when verdict is "Match"', () => {
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match', { pasteDetected: true }),
      rec('Match', { flags: { pasteDetected: true } }),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Handoff Suspected');
    assert.match(res.reason, /2 of the last 3 sessions were not Match/i);
  });

  it('8. Zero-variance / robotic typing counts as non-Match even when verdict is "Match"', () => {
    const records: HandoffRecord[] = [
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match'),
      rec('Match', { flags: { botSuspected: true } }),
      rec('Hard Flag'),
    ];
    const res = detectHandoff(records);
    assert.equal(res.status, 'Handoff Suspected');
  });

  it('9. Null, empty, or undefined input safely returns "Insufficient data"', () => {
    assert.equal(detectHandoff([]).status, 'Insufficient data');
    assert.equal(detectHandoff(null).status, 'Insufficient data');
    assert.equal(detectHandoff(undefined).status, 'Insufficient data');
  });

  it('10. isMatchRecord handles band string compatibility ("match" vs "anomaly")', () => {
    assert.equal(isMatchRecord({ band: 'match' }), true);
    assert.equal(isMatchRecord({ band: 'anomaly' }), false);
    assert.equal(isMatchRecord({ band: 'rushed' }), false);
    assert.equal(isMatchRecord({ band: 'match', flags: { pasteDetected: true } }), false);
  });
});
