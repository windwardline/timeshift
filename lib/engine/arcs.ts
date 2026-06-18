import { getTimes } from 'suncalc';
import { DateTime } from 'luxon';

/**
 * A contiguous stretch of the journey span that is either daylight or darkness
 * at the destination. Boundaries are UTC instants; arcs tile the span exactly.
 */
export interface Arc {
  kind: 'day' | 'night';
  start: Date;
  end: Date;
}

/** Whether an instant falls between its destination-local day's sunrise and sunset. */
function isDaylightAt(instant: Date, lat: number, lng: number, tz: string): boolean {
  const localNoon = DateTime.fromJSDate(instant, { zone: tz })
    .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
  const { sunrise, sunset } = getTimes(localNoon, lat, lng);
  return instant >= sunrise && instant < sunset;
}

/**
 * Tile a journey span into alternating day/night arcs at a destination, with
 * boundaries at SunCalc's sunrise/sunset (US-D2).
 *
 * SunCalc yields sun events per calendar day, so we walk each destination-local
 * day the span touches, collect the sunrise/sunset instants that fall strictly
 * inside the span, and cut the span at them. Each resulting arc is labelled by
 * whether its midpoint is daylight. The arcs tile [spanStart, spanEnd] exactly
 * — contiguous, no gaps or overlaps.
 */
export function dayNightArcs(
  spanStart: Date,
  spanEnd: Date,
  tz: string,
  lat: number,
  lng: number,
): Arc[] {
  const boundaries: Date[] = [];
  let day = DateTime.fromJSDate(spanStart, { zone: tz }).startOf('day');
  const lastDay = DateTime.fromJSDate(spanEnd, { zone: tz }).startOf('day');
  while (day <= lastDay) {
    const localNoon = day.set({ hour: 12 }).toJSDate();
    const { sunrise, sunset } = getTimes(localNoon, lat, lng);
    for (const event of [sunrise, sunset]) {
      if (event > spanStart && event < spanEnd) boundaries.push(event);
    }
    day = day.plus({ days: 1 });
  }
  boundaries.sort((a, b) => a.getTime() - b.getTime());

  const arcs: Arc[] = [];
  let cursor = spanStart;
  for (const edge of [...boundaries, spanEnd]) {
    const midpoint = new Date((cursor.getTime() + edge.getTime()) / 2);
    arcs.push({
      kind: isDaylightAt(midpoint, lat, lng, tz) ? 'day' : 'night',
      start: cursor,
      end: edge,
    });
    cursor = edge;
  }
  return arcs;
}
