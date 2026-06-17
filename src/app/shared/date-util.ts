/**
 * Format a `Date` as a `YYYY-MM-DD` string using the LOCAL calendar date.
 *
 * Prefer this over `date.toISOString().slice(0, 10)`, which formats in UTC and
 * therefore shifts the day for users in timezones offset from UTC. For example,
 * a 7:00 AM check-in in UTC+8 is 11:00 PM the previous day in UTC, so the
 * `toISOString()` form rolls the date back by one — filing the record under the
 * wrong day. This function reads the local calendar components instead, so the
 * stored date always matches the user's wall-clock day.
 */
export function formatLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parse a stored timestamp as an instant. Timestamps are persisted as UTC ISO
 * strings with the trailing `Z` stripped (see `nowUtcString`), so a missing `Z`
 * must be treated as UTC rather than local time.
 */
export function parseStoredTimestamp(ts: string): Date {
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z');
}
