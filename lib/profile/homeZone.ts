import { IANAZone } from 'luxon';

// US-A3 home-time-zone helpers. PURE — no DB, no network.

export type HomeZoneResult =
  | { ok: true; data: string }
  | { ok: false; error: string };

// Validate a home time zone. Validity is delegated to Luxon's IANA database
// rather than any hand-rolled offset/zone list (CLAUDE.md §4).
export function validateHomeTimeZone(raw: unknown): HomeZoneResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Please choose a home time zone.' };
  }
  const tz = raw.trim();
  if (!tz || !IANAZone.isValidZone(tz)) {
    return { ok: false, error: 'That isn’t a recognized time zone.' };
  }
  return { ok: true, data: tz };
}

// The biological-clock baseline for a trip: the traveler's profile home zone
// when set, otherwise the journey's first-departure zone (used for the public
// showcase and for accounts that never set one).
export function resolveHomeBaseline(
  profileZone: string | null | undefined,
  firstDepartureZone: string,
): string {
  return profileZone && profileZone.trim() ? profileZone : firstDepartureZone;
}
