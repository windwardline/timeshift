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
 *
 * DST overlap resolution (decision, per US-E1): a local time that occurs twice
 * because the clocks fell back is resolved to the *first* occurrence — e.g.
 * 2025-11-02T01:30 in America/New_York (02:00 EDT → 01:00 EST) is read as
 * 01:30 EDT (05:30 UTC), not the later 01:30 EST (06:30 UTC). This is Luxon's
 * default for ambiguous times, so — as with the gap case — we inherit it rather
 * than hand-rolling DST logic.
 */
export function toUtc(localISO: string, tz: string): Date {
  return DateTime.fromISO(localISO, { zone: tz }).toUTC().toJSDate();
}

/**
 * True elapsed UTC duration of a segment, in minutes.
 *
 * A JS `Date` is an absolute instant (epoch milliseconds), so subtracting the
 * two instants is inherently leap-day safe: a span crossing 2024-02-29 counts
 * that day exactly once with no calendar arithmetic (see CLAUDE.md §4). The
 * result is positive whenever arrival follows departure in absolute time.
 */
export function durationMinutes(segment: {
  departureTime: Date;
  arrivalTime: Date;
}): number {
  return (segment.arrivalTime.getTime() - segment.departureTime.getTime()) / 60000;
}

/**
 * Add `years` calendar years to a UTC instant, clamping an overflowed day to the
 * last valid day of the target month.
 *
 * Adding to a leap day yields the last valid February day in a non-leap year —
 * 2024-02-29 + 1 year -> 2025-02-28 — rather than overflowing into March. Luxon
 * clamps month overflow by default; native Date.setFullYear would instead roll
 * 2024-02-29 forward to 2025-03-01, so we delegate to Luxon (CLAUDE.md §4).
 */
export function addYears(utc: Date, years: number): Date {
  return DateTime.fromJSDate(utc, { zone: 'utc' }).plus({ years }).toJSDate();
}
