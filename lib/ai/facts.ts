import type { Segment } from '../engine/timeline';
import type { SleepWindow } from '../engine/sleep';

// Structured facts the engine hands to the AI layer. Pure data. The AI feature
// sits strictly downstream of the engine (CLAUDE.md §13 / docs/AI_ADVICE.md):
// the model narrates these already-computed facts and can never feed back into
// the time-math, which is the identity of this project.

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

// AI adapter (US-F1): turn the engine's already-computed outputs into TripFacts.
// PURE — it only reshapes engine results (offsets, IDL flag, sleep windows); it
// performs no time math of its own beyond reading offsets the engine provides.
export function assembleTripFacts(
  segments: Segment[],
  sleepWindows: SleepWindow[],
): TripFacts {
  // Red stub: a placeholder so the test fails on assertion, not on a missing
  // import. Replaced with the real assembly in Green.
  void segments;
  void sleepWindows;
  return {
    originZone: '',
    destinationZone: '',
    offsetDeltaMinutes: 0,
    crossesDateLine: false,
    sleepWindows: [],
  };
}
