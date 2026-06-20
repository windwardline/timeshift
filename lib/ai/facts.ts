// Structured facts the engine hands to the AI layer. Pure data. The AI feature
// sits strictly downstream of the engine (CLAUDE.md §13 / docs/AI_ADVICE.md):
// the model narrates these already-computed facts and can never feed back into
// the time-math, which is the identity of this project.
//
// `assembleTripFacts` (the live engine→facts adapter) depends on Phase 6 sleep
// windows and is added once those exist; the pure AI units are driven against
// TripFacts fixtures and need no live engine.

export interface SleepWindowFact {
  startUtc: string; // ISO-8601 UTC instant
  endUtc: string; // ISO-8601 UTC instant
  label: string; // human-readable, destination-local (e.g. "21:00–01:00 Tokyo")
}

export interface TripFacts {
  originZone: string; // IANA tz of the first departure
  destinationZone: string; // IANA tz of the destination
  offsetDeltaMinutes: number; // destination offset − origin offset, in minutes
  crossesDateLine: boolean;
  sleepWindows: SleepWindowFact[];
}
