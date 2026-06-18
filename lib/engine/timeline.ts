export interface Segment {
  departureTime: Date;
  arrivalTime: Date;
  departureTz: string;
  arrivalTz: string;
}

export interface Trip {
  segments: Segment[];
}

export interface TimelineItem {
  kind: 'flight' | 'layover';
  start: Date;
  end: Date;
}

/**
 * Segments and layover gaps laid on one continuous UTC axis from first departure
 * to final arrival. `totalMinutes` is the axis span; consumers derive pixel
 * positions/widths from each item's start/end against it.
 */
export interface TimelineModel {
  start: Date;
  end: Date;
  totalMinutes: number;
  items: TimelineItem[];
}

export function assembleTimeline(trip: Trip): TimelineModel {
  const { segments } = trip;
  const start = segments[0].departureTime;
  const end = segments[segments.length - 1].arrivalTime;

  const items: TimelineItem[] = [];
  segments.forEach((seg, i) => {
    items.push({ kind: 'flight', start: seg.departureTime, end: seg.arrivalTime });
    // Layover = the ground gap before the next segment. Segments are assumed
    // well-ordered with a positive gap (the API layer validates ordering); a
    // zero/negative gap is not handled yet and has no test — US-D3 specifies a gap.
    const next = segments[i + 1];
    if (next) {
      items.push({ kind: 'layover', start: seg.arrivalTime, end: next.departureTime });
    }
  });

  const totalMinutes = (end.getTime() - start.getTime()) / 60000;
  return { start, end, totalMinutes, items };
}
