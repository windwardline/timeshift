import { DateTime } from 'luxon';

// Validate flight-search params before building the upstream request (spec §7).
// PURE. IATA must be three uppercase letters; the date must be a real calendar
// date within [today, +1 year]. `now` is injected for deterministic tests.

export type SearchParams = { from: string; to: string; date: string };
export type ValidateResult = { ok: true; data: SearchParams } | { ok: false; error: string };

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateSearchParams(raw: unknown, now: Date = new Date()): ValidateResult {
  const p = raw as Partial<Record<keyof SearchParams, unknown>> | null;
  const from = p?.from;
  const to = p?.to;
  const date = p?.date;

  if (typeof from !== 'string' || typeof to !== 'string' || typeof date !== 'string') {
    return { ok: false, error: 'Choose a departure airport, an arrival airport, and a date.' };
  }
  if (!IATA.test(from) || !IATA.test(to)) {
    return { ok: false, error: 'Airport codes must be three letters (e.g. JFK).' };
  }
  if (from === to) {
    return { ok: false, error: 'Departure and arrival airports must differ.' };
  }
  if (!DATE.test(date)) {
    return { ok: false, error: 'Use a date in YYYY-MM-DD format.' };
  }

  const parsed = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: 'utc' });
  if (!parsed.isValid) {
    return { ok: false, error: 'That date isn’t a real calendar date.' };
  }

  const today = DateTime.fromJSDate(now, { zone: 'utc' }).startOf('day');
  if (parsed < today) {
    return { ok: false, error: 'Pick a date that isn’t in the past.' };
  }
  if (parsed > today.plus({ years: 1 })) {
    return { ok: false, error: 'Pick a date within the next year.' };
  }

  return { ok: true, data: { from, to, date } };
}
