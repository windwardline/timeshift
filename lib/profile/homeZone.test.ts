import { describe, it, expect } from 'vitest';
import { validateHomeTimeZone, resolveHomeBaseline } from './homeZone';

// US-A3: a traveler sets a home time zone on their profile, and that zone is the
// biological-clock baseline for their trips. Two pure units back the feature:
// input validation (delegated to Luxon's IANA database, never a hand-rolled
// list — CLAUDE.md §4) and the baseline-resolution fallback.

describe('validateHomeTimeZone', () => {
  it('accepts a valid IANA zone and returns it', () => {
    expect(validateHomeTimeZone('Asia/Singapore')).toEqual({ ok: true, data: 'Asia/Singapore' });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateHomeTimeZone('  Europe/London  ')).toEqual({ ok: true, data: 'Europe/London' });
  });

  it('rejects an unknown zone', () => {
    expect(validateHomeTimeZone('Mars/Phobos').ok).toBe(false);
  });

  it('rejects empty and non-string input', () => {
    expect(validateHomeTimeZone('').ok).toBe(false);
    expect(validateHomeTimeZone('   ').ok).toBe(false);
    expect(validateHomeTimeZone(undefined).ok).toBe(false);
    expect(validateHomeTimeZone(42).ok).toBe(false);
  });
});

describe('resolveHomeBaseline', () => {
  it('prefers the traveler’s profile zone when set', () => {
    expect(resolveHomeBaseline('Asia/Tokyo', 'America/New_York')).toBe('Asia/Tokyo');
  });

  it('falls back to the first-departure zone when no profile zone is set', () => {
    expect(resolveHomeBaseline(undefined, 'America/New_York')).toBe('America/New_York');
    expect(resolveHomeBaseline(null, 'America/New_York')).toBe('America/New_York');
    expect(resolveHomeBaseline('  ', 'America/New_York')).toBe('America/New_York');
  });
});
