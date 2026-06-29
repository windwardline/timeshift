// Display helper for the Jetlag Plan's "Computed from your flight" chip strip.
// PURE and client-safe (no engine/network imports): it only formats the engine's
// already-computed facts into short labels, making it visible that the Plan is
// derived from this itinerary's real numbers — the feature's signature mechanic.

/** Minimal subset of the engine's TripFacts this helper needs (kept local so
 *  lib/trips stays independent of the server-only lib/ai layer). */
export interface ComputedFactsInput {
  offsetDeltaMinutes: number;
  crossesDateLine: boolean;
  sleepWindows: { label: string }[];
}

export function describeComputedFacts(facts: ComputedFactsInput): string[] {
  const chips: string[] = [];

  // The UTC-offset shift the traveler actually experiences, with direction.
  const hours = facts.offsetDeltaMinutes / 60;
  const direction = hours > 0 ? ' eastward' : hours < 0 ? ' westward' : '';
  const magnitude = hours > 0 ? `+${hours.toFixed(1)}` : hours.toFixed(1);
  chips.push(`${magnitude}h${direction} shift`);

  // The specific in-flight sleep window(s) the engine recommended.
  const n = facts.sleepWindows.length;
  if (n === 1) chips.push(`sleep ${facts.sleepWindows[0].label}`);
  else if (n > 1) chips.push(`${n} in-flight sleep windows`);

  if (facts.crossesDateLine) chips.push('crosses the Date Line');

  return chips;
}
