import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatLocalDate, parseStoredTimestamp } from './date-util';

describe('formatLocalDate', () => {
  it('uses local calendar components, not UTC', () => {
    // Constructed from local components, so this assertion holds in any host
    // timezone. A reversion to `toISOString().slice(0, 10)` would break it in
    // any timezone offset from UTC.
    const local = new Date(2026, 5, 15, 7, 0, 0); // June 15 2026, 07:00 local
    expect(formatLocalDate(local)).toBe('2026-06-15');
  });

  it('zero-pads month and day', () => {
    expect(formatLocalDate(new Date(2026, 0, 3, 12, 0, 0))).toBe('2026-01-03');
  });

  describe('in a UTC+8 timezone (Asia/Manila)', () => {
    beforeAll(() => {
      vi.stubEnv('TZ', 'Asia/Manila');
    });
    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('keeps an early-morning check-in on the same local day', () => {
      // 07:00 on Mon June 15 in UTC+8 is 23:00 Sun June 14 in UTC. The old
      // UTC-based formatter rolled this back to "2026-06-14" — the original bug.
      const earlyMorning = new Date('2026-06-14T23:00:00Z');
      expect(earlyMorning.getHours()).toBe(7); // sanity: TZ override is active
      expect(formatLocalDate(earlyMorning)).toBe('2026-06-15');
      // Document the bug being fixed:
      expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-06-14');
    });

    it('handles a late-evening check-in correctly too', () => {
      // 23:00 local June 15 is 15:00 UTC June 15 — both agree, never regressed.
      const lateEvening = new Date('2026-06-15T15:00:00Z');
      expect(lateEvening.getHours()).toBe(23);
      expect(formatLocalDate(lateEvening)).toBe('2026-06-15');
    });
  });
});

describe('attendance date migration (version 5) repair logic', () => {
  // Mirrors the transform db.ts runs per attendance row:
  //   row.date = formatLocalDate(parseStoredTimestamp(row.checkIn))
  beforeAll(() => {
    vi.stubEnv('TZ', 'Asia/Manila');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const repair = (checkIn: string) => formatLocalDate(parseStoredTimestamp(checkIn));

  it('re-derives the corrupted date from the check-in timestamp', () => {
    // Stored as UTC with the trailing Z stripped (see nowUtcString).
    const checkIn = '2026-06-14T23:00:00'; // = June 15 07:00 in UTC+8
    expect(repair(checkIn)).toBe('2026-06-15');
  });

  it('also parses timestamps that retain a trailing Z', () => {
    expect(repair('2026-06-14T23:00:00Z')).toBe('2026-06-15');
  });

  it('leaves an already-correct date unchanged', () => {
    const checkIn = '2026-06-15T05:00:00'; // = June 15 13:00 in UTC+8
    expect(repair(checkIn)).toBe('2026-06-15');
  });
});
