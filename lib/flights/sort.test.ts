import { describe, it, expect } from 'vitest';
import { sortFlights } from './sort';
import type { FlightOption } from './types';

// Sorts FlightOption[] by departure/arrival instant or duration, ascending,
// stably, without mutating the input (spec §4). Departure/arrival compare the
// true UTC instant (local + zone), not the naive wall clock.

function opt(over: Partial<FlightOption>): FlightOption {
  return {
    flightNumber: 'XX 1',
    airlineName: null,
    departureIata: 'JFK',
    arrivalIata: 'LHR',
    departureLocal: '2026-07-02T08:00',
    arrivalLocal: '2026-07-02T20:00',
    departureTz: 'America/New_York',
    arrivalTz: 'Europe/London',
    departureTerminal: null,
    arrivalTerminal: null,
    durationMinutes: 420,
    ...over,
  };
}

const early = opt({ flightNumber: 'A', departureLocal: '2026-07-02T06:00', arrivalLocal: '2026-07-02T19:00', durationMinutes: 480 });
const mid = opt({ flightNumber: 'B', departureLocal: '2026-07-02T08:00', arrivalLocal: '2026-07-02T17:00', durationMinutes: 300 });
const late = opt({ flightNumber: 'C', departureLocal: '2026-07-02T10:00', arrivalLocal: '2026-07-02T22:00', durationMinutes: 420 });

describe('sortFlights', () => {
  it('sorts by departure instant ascending', () => {
    expect(sortFlights([late, early, mid], 'departure').map((f) => f.flightNumber)).toEqual(['A', 'B', 'C']);
  });

  it('sorts by arrival instant ascending', () => {
    expect(sortFlights([late, early, mid], 'arrival').map((f) => f.flightNumber)).toEqual(['B', 'A', 'C']);
  });

  it('sorts by duration ascending', () => {
    expect(sortFlights([late, early, mid], 'duration').map((f) => f.flightNumber)).toEqual(['B', 'C', 'A']);
  });

  it('is stable on ties and does not mutate the input', () => {
    const a = opt({ flightNumber: 'first', departureLocal: '2026-07-02T08:00' });
    const b = opt({ flightNumber: 'second', departureLocal: '2026-07-02T08:00' });
    const input = [a, b];
    expect(sortFlights(input, 'departure').map((f) => f.flightNumber)).toEqual(['first', 'second']);
    expect(input).toEqual([a, b]); // unchanged
  });
});
