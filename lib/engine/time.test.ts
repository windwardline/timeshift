import { describe, it, expect } from 'vitest';
import { offsetMinutes } from './time';

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
