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
  return { start: new Date(0), end: new Date(0), totalMinutes: 0, items: [] };
}
