import { describe, it, expect } from 'vitest';
import { assembleTimeline } from './timeline';
import { recommendSleepWindows } from './sleep';

// P6.1 / US-E4: on a long-haul red-eye, recommend at least one in-air sleep
// window aligned to destination night. JFK -> HND (15h); the UTC span is chosen
// so Tokyo night (22:00-06:00 JST = 13:00Z-21:00Z) falls entirely inside the
// flight, so the engine should return exactly that window — within the in-air
// segment, never on the ground.
describe('recommendSleepWindows', () => {
  it('recommends an in-air window aligned to destination night on a red-eye', () => {
    const trip = {
      segments: [
        {
          departureTime: new Date('2025-06-02T10:00:00Z'),
          arrivalTime: new Date('2025-06-03T01:00:00Z'),
          departureTz: 'America/New_York',
          arrivalTz: 'Asia/Tokyo',
        },
      ],
    };
    const timeline = assembleTimeline(trip);

    const windows = recommendSleepWindows(timeline, 'America/New_York', 'Asia/Tokyo');

    expect(windows).toHaveLength(1);
    const [w] = windows;
    expect(w.start).toEqual(new Date('2025-06-02T13:00:00Z'));
    expect(w.end).toEqual(new Date('2025-06-02T21:00:00Z'));
    // entirely within the in-air segment
    expect(w.start.getTime()).toBeGreaterThanOrEqual(timeline.items[0].start.getTime());
    expect(w.end.getTime()).toBeLessThanOrEqual(timeline.items[0].end.getTime());
    // label reads in destination-local night clock
    expect(w.label).toContain('22:00');
    expect(w.label).toContain('Asia/Tokyo');
  });
});
