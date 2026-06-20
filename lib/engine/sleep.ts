import type { TimelineModel } from './timeline';

/**
 * A recommended in-flight sleep window: an absolute UTC interval that lies
 * inside an in-air segment and overlaps destination nighttime, with a
 * human-readable destination-local (and home-local) label.
 */
export interface SleepWindow {
  start: Date; // UTC
  end: Date; // UTC
  label: string;
}

export function recommendSleepWindows(
  timeline: TimelineModel,
  homeTz: string,
  destTz: string,
): SleepWindow[] {
  // Red stub: returns no windows so the red-eye test fails on assertion, not on
  // a missing import. Replaced with the real clipping logic in Green.
  void timeline;
  void homeTz;
  void destTz;
  return [];
}
