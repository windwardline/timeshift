import { DateTime } from 'luxon';

/**
 * DST-aware UTC offset (in minutes) for a zone at a given instant.
 *
 * Delegates to Luxon's IANA tz database rather than hand-rolling offset/DST
 * tables (see CLAUDE.md §4). A JS `Date` is an absolute instant; re-expressing
 * it in `tz` yields the correct offset for that moment — e.g. America/New_York
 * is -300 (EST) in winter and -240 (EDT) in summer.
 */
export function offsetMinutes(utc: Date, tz: string): number {
  return DateTime.fromJSDate(utc, { zone: tz }).offset;
}

/**
 * Normalize a local wall-clock time (ISO string, no offset) in zone `tz` to a
 * UTC `Date`.
 *
 * DST gap resolution (decision, per acceptance criteria US-E1): a local time
 * that does not exist because the clocks sprang forward is resolved *forward* —
 * e.g. 2025-03-09T02:30 in America/New_York (02:00 EST → 03:00 EDT) becomes
 * 03:30 EDT (07:30 UTC). This matches a traveler's intuition that "the clock
 * skipped ahead", and is Luxon's default handling of gap times, so we rely on
 * it rather than hand-rolling DST logic (see CLAUDE.md §4).
 */
export function toUtc(localISO: string, tz: string): Date {
  return DateTime.fromISO(localISO, { zone: tz }).toUTC().toJSDate();
}
