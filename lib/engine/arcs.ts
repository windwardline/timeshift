/**
 * A contiguous stretch of the journey span that is either daylight or darkness
 * at the destination. Boundaries are UTC instants; arcs tile the span exactly.
 */
export interface Arc {
  kind: 'day' | 'night';
  start: Date;
  end: Date;
}

export function dayNightArcs(
  spanStart: Date,
  spanEnd: Date,
  tz: string,
  lat: number,
  lng: number,
): Arc[] {
  return [];
}
