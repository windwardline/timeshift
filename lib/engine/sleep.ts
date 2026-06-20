import { DateTime } from 'luxon';
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

// Destination-local night, as wall-clock hours. Sleep is recommended only where
// an in-air segment overlaps this window, so the body clock starts shifting
// toward the destination before landing (US-E4).
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

function clock(instant: Date, tz: string): string {
  return DateTime.fromJSDate(instant, { zone: tz }).toFormat('HH:mm');
}

/**
 * Recommend in-flight sleep windows aligned to destination night.
 *
 * For each in-air (flight) segment — layovers and ground time are skipped, so a
 * window can never fall outside an in-air segment — we walk the destination-local
 * nights the segment touches, clip each night to the segment, and keep any
 * non-empty overlap. Boundaries stay in absolute UTC; offset/DST is delegated to
 * Luxon (CLAUDE.md §4). The label reads the window in destination-local night
 * clock alongside the traveler's home clock.
 */
export function recommendSleepWindows(
  timeline: TimelineModel,
  homeTz: string,
  destTz: string,
): SleepWindow[] {
  const windows: SleepWindow[] = [];

  for (const item of timeline.items) {
    if (item.kind !== 'flight') continue;

    // Start one day early so a night that began the previous evening is caught.
    let day = DateTime.fromJSDate(item.start, { zone: destTz })
      .startOf('day')
      .minus({ days: 1 });
    const lastDay = DateTime.fromJSDate(item.end, { zone: destTz }).startOf('day');

    while (day <= lastDay) {
      const nightStart = day.set({ hour: NIGHT_START_HOUR }).toJSDate();
      const nightEnd = day.plus({ days: 1 }).set({ hour: NIGHT_END_HOUR }).toJSDate();

      const start = new Date(Math.max(item.start.getTime(), nightStart.getTime()));
      const end = new Date(Math.min(item.end.getTime(), nightEnd.getTime()));

      if (start < end) {
        windows.push({
          start,
          end,
          label: `${clock(start, destTz)}–${clock(end, destTz)} ${destTz} (${clock(start, homeTz)}–${clock(end, homeTz)} ${homeTz})`,
        });
      }
      day = day.plus({ days: 1 });
    }
  }

  return windows;
}
