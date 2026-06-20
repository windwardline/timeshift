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
  // Red stub: a placeholder so the test fails on assertion, not on a missing
  // import. Replaced in Green.
  void instant;
  void axis;
  return -1;
}

/** Map a UTC interval to a positioned rect on a pixel axis of the given width. */
export function intervalToRect(
  start: Date,
  end: Date,
  axis: Axis,
  width: number,
): { x: number; width: number } {
  void start;
  void end;
  void axis;
  void width;
  return { x: -1, width: -1 };
}
