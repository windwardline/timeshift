import { describe, it, expect } from 'vitest';
import { normalizeTripInput, normalizeSegmentInput } from './normalize';

// US-C1: trip-builder input is validated and normalized — local wall-times
// become UTC instants, legs are sequenced, the destination is derived from the
// final arrival, and an invalid leg is rejected with a clear message.

const validLeg = {
  departureAirport: 'JFK',
  arrivalAirport: 'LHR',
  departureLocal: '2025-06-01T18:00',
  arrivalLocal: '2025-06-02T06:00',
  departureTz: 'America/New_York',
  arrivalTz: 'Europe/London',
  departureLat: 40.6413,
  departureLng: -73.7781,
  arrivalLat: 51.47,
  arrivalLng: -0.4543,
};

describe('normalizeTripInput', () => {
  it('normalizes a valid trip: UTC times, sequence, derived destination', () => {
    const result = normalizeTripInput({ name: 'NYC → London', segments: [validLeg] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('NYC → London');
    expect(result.data.destination).toBe('Europe/London');
    expect(result.data.segments).toHaveLength(1);
    const seg = result.data.segments[0];
    expect(seg.sequence).toBe(0);
    // 18:00 EDT (-4) → 22:00Z
    expect(seg.departureTime.toISOString()).toBe('2025-06-01T22:00:00.000Z');
    // 06:00 BST (+1) → 05:00Z
    expect(seg.arrivalTime.toISOString()).toBe('2025-06-02T05:00:00.000Z');
    // US-C4: geo-coords ride through to the persisted segment so the arcs resolve.
    expect(seg.departureLat).toBe(40.6413);
    expect(seg.departureLng).toBe(-73.7781);
    expect(seg.arrivalLat).toBe(51.47);
    expect(seg.arrivalLng).toBe(-0.4543);
  });

  it('rejects a leg that arrives before it departs in UTC', () => {
    const result = normalizeTripInput({
      name: 'Impossible',
      segments: [{ ...validLeg, arrivalLocal: '2025-06-01T17:00' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/before it departs/i);
  });

  it('rejects an invalid time zone', () => {
    const result = normalizeTripInput({
      name: 'Bad zone',
      segments: [{ ...validLeg, departureTz: 'Not/AZone' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = normalizeTripInput({ name: '', segments: [] });
    expect(result.ok).toBe(false);
  });
});

describe('normalizeSegmentInput', () => {
  it('normalizes one leg to UTC and preserves coordinates (no sequence assigned)', () => {
    const result = normalizeSegmentInput(validLeg);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.departureTime.toISOString()).toBe('2025-06-01T22:00:00.000Z');
    expect(result.data.arrivalTime.toISOString()).toBe('2025-06-02T05:00:00.000Z');
    expect(result.data.departureTz).toBe('America/New_York');
    expect(result.data.arrivalTz).toBe('Europe/London');
    expect(result.data.departureLat).toBe(40.6413);
    expect(result.data.arrivalLng).toBe(-0.4543);
    expect('sequence' in result.data).toBe(false);
  });

  it('carries an optional flight number through (for the timeline label + live status)', () => {
    const result = normalizeSegmentInput({ ...validLeg, flightNumber: 'BA 178' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.flightNumber).toBe('BA 178');
  });

  it('rejects a leg that arrives before it departs in UTC', () => {
    const result = normalizeSegmentInput({ ...validLeg, arrivalLocal: '2025-06-01T17:00' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/before it departs/i);
  });

  it('rejects an invalid time zone', () => {
    const result = normalizeSegmentInput({ ...validLeg, arrivalTz: 'Not/AZone' });
    expect(result.ok).toBe(false);
  });

  it('rejects a structurally invalid leg', () => {
    const result = normalizeSegmentInput({ departureAirport: 'JF' });
    expect(result.ok).toBe(false);
  });
});
