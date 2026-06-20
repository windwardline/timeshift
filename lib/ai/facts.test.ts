import { describe, it, expect } from 'vitest';
import { assembleTripFacts } from './facts';
import type { Segment } from '../engine/timeline';
import type { SleepWindow } from '../engine/sleep';

// US-F1: assembleTripFacts reshapes the engine's outputs into the TripFacts the
// AI layer narrates. A JFK -> HND red-eye: Tokyo (+540) vs New York EDT (-240)
// is a +780-minute delta, no date-line crossing, with one engine-computed sleep
// window. The adapter must derive origin/destination zones, the offset delta,
// the IDL flag, and map sleep windows to ISO-string facts.
describe('assembleTripFacts', () => {
  it('derives zones, offset delta, IDL flag, and sleep-window facts', () => {
    const segments: Segment[] = [
      {
        departureTime: new Date('2025-06-02T10:00:00Z'),
        arrivalTime: new Date('2025-06-03T01:00:00Z'),
        departureTz: 'America/New_York',
        arrivalTz: 'Asia/Tokyo',
      },
    ];
    const sleepWindows: SleepWindow[] = [
      {
        start: new Date('2025-06-02T13:00:00Z'),
        end: new Date('2025-06-02T21:00:00Z'),
        label: '22:00–06:00 Asia/Tokyo (09:00–17:00 America/New_York)',
      },
    ];

    const facts = assembleTripFacts(segments, sleepWindows);

    expect(facts).toEqual({
      originZone: 'America/New_York',
      destinationZone: 'Asia/Tokyo',
      offsetDeltaMinutes: 780,
      crossesDateLine: false,
      sleepWindows: [
        {
          startUtc: '2025-06-02T13:00:00.000Z',
          endUtc: '2025-06-02T21:00:00.000Z',
          label: '22:00–06:00 Asia/Tokyo (09:00–17:00 America/New_York)',
        },
      ],
    });
  });
});
