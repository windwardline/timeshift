/**
 * Positioning math for the timeline visualization (US-D1). Pure and test-driven
 * per CLAUDE.md §4 ("arc positioning" is engine reasoning): it maps absolute UTC
 * instants onto a horizontal pixel axis so segments, layovers, day/night arcs,
 * and sleep windows all share one time-to-x scale.
 */
export interface Axis {
  start: Date;
  end: Date;
}

/** Fraction [0, 1] of an instant along the axis span. */
export function fractionAt(instant: Date, axis: Axis): number {
  const span = axis.end.getTime() - axis.start.getTime();
  return (instant.getTime() - axis.start.getTime()) / span;
}

/** Map a UTC interval to a positioned rect on a pixel axis of the given width. */
export function intervalToRect(
  start: Date,
  end: Date,
  axis: Axis,
  width: number,
): { x: number; width: number } {
  const x = fractionAt(start, axis) * width;
  return { x, width: (fractionAt(end, axis) - fractionAt(start, axis)) * width };
}
