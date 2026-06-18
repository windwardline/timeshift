import { describe, it, expect } from 'vitest';
import { assembleTimeline } from './timeline';

// US-D1/D3: assembleTimeline lays a multi-segment trip on one continuous UTC
// axis from first departure to final arrival, inserting a distinct layover block
// for the ground gap between consecutive segments. Trip: JFK -> LHR
// (22:00 -> 05:00Z, 7h), a 3h layover at LHR, then LHR -> onward
// (08:00 -> 11:00Z, 3h). The axis spans 13h (780 min); items are flight, layover,
// flight in travel order, each spanning its real start/end (so widths are correct).
describe('assembleTimeline', () => {
  it('places segments and a layover block on one continuous UTC axis in order', () => {
    const trip = {
      segments: [
        {
          departureTime: new Date('2025-06-01T22:00:00Z'),
          arrivalTime: new Date('2025-06-02T05:00:00Z'),
          departureTz: 'America/New_York',
          arrivalTz: 'Europe/London',
        },
        {
          departureTime: new Date('2025-06-02T08:00:00Z'),
          arrivalTime: new Date('2025-06-02T11:00:00Z'),
          departureTz: 'Europe/London',
          arrivalTz: 'Europe/Berlin',
        },
      ],
    };

    const timeline = assembleTimeline(trip);

    expect(timeline).toEqual({
      start: new Date('2025-06-01T22:00:00Z'),
      end: new Date('2025-06-02T11:00:00Z'),
      totalMinutes: 780,
      items: [
        { kind: 'flight', start: new Date('2025-06-01T22:00:00Z'), end: new Date('2025-06-02T05:00:00Z') },
        { kind: 'layover', start: new Date('2025-06-02T05:00:00Z'), end: new Date('2025-06-02T08:00:00Z') },
        { kind: 'flight', start: new Date('2025-06-02T08:00:00Z'), end: new Date('2025-06-02T11:00:00Z') },
      ],
    });
  });
});
