import { describe, it, expect } from 'vitest';
import { getTimes } from 'suncalc';
import { dayNightArcs } from './arcs';

// US-D2: dayNightArcs tiles a journey span into alternating day/night arcs whose
// boundaries are SunCalc's sunrise/sunset. Accra is UTC+0 with no DST and sits
// near the equator, so the local calendar day equals the UTC day and the sun
// cleanly rises and sets — a deterministic fixture free of tz-boundary effects.
// Over a full day the span is night -> day -> night, split exactly at sunrise
// and sunset, with the arcs tiling the span end-to-end (no gaps or overlaps).
describe('dayNightArcs', () => {
  const LAT = 5.6037;
  const LNG = -0.187;
  const spanStart = new Date('2025-06-21T00:00:00Z');
  const spanEnd = new Date('2025-06-22T00:00:00Z');

  it('tiles the span into night/day/night split at SunCalc sunrise and sunset', () => {
    const { sunrise, sunset } = getTimes(new Date('2025-06-21T12:00:00Z'), LAT, LNG);

    const arcs = dayNightArcs(spanStart, spanEnd, 'Africa/Accra', LAT, LNG);

    expect(arcs).toEqual([
      { kind: 'night', start: spanStart, end: sunrise },
      { kind: 'day', start: sunrise, end: sunset },
      { kind: 'night', start: sunset, end: spanEnd },
    ]);
  });
});
