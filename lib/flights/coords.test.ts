import { describe, it, expect } from 'vitest';
import { resolveCoords } from './coords';

// Resolves an airport's coordinates from the curated list (spec §4 / US-C4) so
// the timeline's day/night arcs can be drawn. A code we don't carry returns null,
// and the arcs degrade cleanly. PURE.

describe('resolveCoords', () => {
  it('returns coordinates for a curated airport', () => {
    expect(resolveCoords('JFK')).toEqual({ lat: 40.6413, lng: -73.7781 });
  });

  it('is case-insensitive on the IATA code', () => {
    expect(resolveCoords('jfk')).toEqual({ lat: 40.6413, lng: -73.7781 });
  });

  it('returns null for an airport not in the curated list', () => {
    expect(resolveCoords('XXX')).toBeNull();
  });
});
