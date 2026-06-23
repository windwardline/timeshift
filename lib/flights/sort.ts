import { toUtc } from '../engine/time';
import type { FlightOption, SortKey } from './types';

// Sort flight options ascending by the chosen key, stably and without mutating
// the input. Departure/arrival compare the true UTC instant (local + zone) via
// the engine, so zones never skew the order. PURE.

function metric(f: FlightOption, key: SortKey): number {
  switch (key) {
    case 'departure':
      return toUtc(f.departureLocal, f.departureTz).getTime();
    case 'arrival':
      return toUtc(f.arrivalLocal, f.arrivalTz).getTime();
    case 'duration':
      return f.durationMinutes;
  }
}

export function sortFlights(list: FlightOption[], key: SortKey): FlightOption[] {
  // map-to-index keeps the sort stable on ties regardless of the engine's sort.
  return list
    .map((flight, index) => ({ flight, index }))
    .sort((a, b) => metric(a.flight, key) - metric(b.flight, key) || a.index - b.index)
    .map(({ flight }) => flight);
}
