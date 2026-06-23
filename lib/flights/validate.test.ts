import { describe, it, expect } from 'vitest';
import { validateSearchParams } from './validate';

// Pure validation of flight-search params before any upstream call (spec §7):
// IATA codes and a calendar date inside a sane window. `now` is injected so the
// window check is deterministic in tests.
const NOW = new Date('2026-07-01T12:00:00Z');

describe('validateSearchParams', () => {
  it('accepts valid uppercase IATA codes and an in-window date', () => {
    const r = validateSearchParams({ from: 'JFK', to: 'LHR', date: '2026-07-02' }, NOW);
    expect(r).toEqual({ ok: true, data: { from: 'JFK', to: 'LHR', date: '2026-07-02' } });
  });

  it('accepts a same-day search', () => {
    expect(validateSearchParams({ from: 'JFK', to: 'LHR', date: '2026-07-01' }, NOW).ok).toBe(true);
  });

  it('rejects malformed IATA codes', () => {
    expect(validateSearchParams({ from: 'jfk', to: 'LHR', date: '2026-07-02' }, NOW).ok).toBe(false);
    expect(validateSearchParams({ from: 'JF', to: 'LHR', date: '2026-07-02' }, NOW).ok).toBe(false);
    expect(validateSearchParams({ from: 'JFKK', to: 'LHR', date: '2026-07-02' }, NOW).ok).toBe(false);
  });

  it('rejects identical origin and destination', () => {
    expect(validateSearchParams({ from: 'JFK', to: 'JFK', date: '2026-07-02' }, NOW).ok).toBe(false);
  });

  it('rejects malformed or impossible dates', () => {
    expect(validateSearchParams({ from: 'JFK', to: 'LHR', date: '2026-7-2' }, NOW).ok).toBe(false);
    expect(validateSearchParams({ from: 'JFK', to: 'LHR', date: 'nope' }, NOW).ok).toBe(false);
    expect(validateSearchParams({ from: 'JFK', to: 'LHR', date: '2026-02-30' }, NOW).ok).toBe(false);
  });

  it('rejects a past date or one more than a year out', () => {
    expect(validateSearchParams({ from: 'JFK', to: 'LHR', date: '2026-06-30' }, NOW).ok).toBe(false);
    expect(validateSearchParams({ from: 'JFK', to: 'LHR', date: '2027-07-02' }, NOW).ok).toBe(false);
  });

  it('rejects missing or non-string fields', () => {
    expect(validateSearchParams({ from: 'JFK', to: 'LHR' }, NOW).ok).toBe(false);
    expect(validateSearchParams(null, NOW).ok).toBe(false);
    expect(validateSearchParams({ from: 1, to: 2, date: 3 }, NOW).ok).toBe(false);
  });
});
