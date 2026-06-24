import { findAirport } from '../airports';

// Resolve an airport's coordinates from the curated list (US-C4) for the
// timeline's day/night arcs. A code we don't carry returns null and the arcs
// degrade cleanly (TripView guards on null lat/lng). PURE.
export function resolveCoords(iata: string): { lat: number; lng: number } | null {
  const airport = findAirport(iata.toUpperCase());
  return airport ? { lat: airport.lat, lng: airport.lng } : null;
}
