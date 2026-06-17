import { describe, it, expect } from 'vitest';
import { offsetMinutes, toUtc, durationMinutes, addYears } from './time';

// US-E1: UTC offsets must be DST-aware. America/New_York is EST (-300) in winter
// and EDT (-240) in summer; a static offset would get one of these wrong.
describe('offsetMinutes', () => {
  it('returns -300 (EST) for America/New_York in January', () => {
    const utc = new Date('2025-01-15T12:00:00Z');
    expect(offsetMinutes(utc, 'America/New_York')).toBe(-300);
  });

  it('returns -240 (EDT) for America/New_York in July', () => {
    const utc = new Date('2025-07-15T12:00:00Z');
    expect(offsetMinutes(utc, 'America/New_York')).toBe(-240);
  });
});

// US-E1: a spring-forward local time that does not exist must resolve
// deterministically and not throw. On 2025-03-09 in America/New_York, 02:00 EST
// jumps to 03:00 EDT, so 02:30 never happens. We resolve forward → 03:30 EDT,
// which is 07:30 UTC.
describe('toUtc', () => {
  it('resolves a spring-forward non-existent local time forward without throwing', () => {
    let result: Date | undefined;
    expect(() => {
      result = toUtc('2025-03-09T02:30', 'America/New_York');
    }).not.toThrow();
    expect(result?.toISOString()).toBe('2025-03-09T07:30:00.000Z');
  });

  // US-E1: a fall-back ambiguous local time occurs twice. On 2025-11-02 in
  // America/New_York, 02:00 EDT falls back to 01:00 EST, so 01:30 happens at
  // both 01:30 EDT (UTC-4 -> 05:30 UTC) and 01:30 EST (UTC-5 -> 06:30 UTC). We
  // resolve to the FIRST occurrence (01:30 EDT = 05:30 UTC) deterministically.
  it('resolves a fall-back ambiguous local time to the first occurrence without throwing', () => {
    let result: Date | undefined;
    expect(() => {
      result = toUtc('2025-11-02T01:30', 'America/New_York');
    }).not.toThrow();
    expect(result?.toISOString()).toBe('2025-11-02T05:30:00.000Z');
  });
});

// US-E2: durationMinutes is the true elapsed UTC minutes between a segment's
// departure and arrival. A span crossing the leap day 2024-02-29 must count that
// day exactly once: 2024-02-28T12:00Z -> 2024-03-01T12:00Z is two full days
// (2880 min) because 2024 is a leap year, not 1440. Deriving the duration from
// the absolute UTC instants keeps it leap-safe.
describe('durationMinutes', () => {
  it('counts the leap day 2024-02-29 exactly once across a UTC span', () => {
    const segment = {
      departureTime: new Date('2024-02-28T12:00:00Z'),
      arrivalTime: new Date('2024-03-01T12:00:00Z'),
    };
    expect(durationMinutes(segment)).toBe(2880);
  });
});

// US-E2: adding one calendar year to a leap day must not invent a phantom
// Feb 29 in a non-leap year. 2024-02-29 + 1 year clamps to the last valid day
// of February 2025 -> 2025-02-28, not 2025-03-01.
describe('addYears', () => {
  it('clamps leap-day 2024-02-29 + 1 year to 2025-02-28', () => {
    const result = addYears(new Date('2024-02-29T00:00:00Z'), 1);
    expect(result.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });
});
