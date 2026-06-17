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
