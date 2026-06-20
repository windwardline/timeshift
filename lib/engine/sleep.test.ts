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

  // P6.3 / US-E4: a short daytime hop has no in-air time overlapping destination
  // night, so the engine recommends zero windows (sleeping wouldn't help). Green
  // on arrival — the general night-clipping logic already yields no windows when
  // nothing overlaps destination night; no fabricated red.
  it('recommends no sleep windows for a short daytime hop', () => {
    const trip = {
      segments: [
        {
          departureTime: new Date('2025-06-02T09:00:00Z'),
          arrivalTime: new Date('2025-06-02T11:00:00Z'),
          departureTz: 'Europe/London',
          arrivalTz: 'Europe/Paris',
        },
      ],
    };
    const timeline = assembleTimeline(trip);

    const windows = recommendSleepWindows(timeline, 'Europe/London', 'Europe/Paris');

    expect(windows).toEqual([]);
  });

  // P6.1 acceptance ("never during a layover"): a layover that itself falls in
  // destination night must NOT be recommended, because it is ground time. Here
  // the LHR layover (17:00-20:00Z) sits inside Tokyo night (13:00-21:00Z), yet
  // sleep is only recommended within the two in-air legs around it. Green on
  // arrival — the in-air guard already excludes layovers; this pins it.
  it('never recommends sleep during a layover, even one in destination night', () => {
    const trip = {
      segments: [
        {
          departureTime: new Date('2025-06-02T10:00:00Z'),
          arrivalTime: new Date('2025-06-02T17:00:00Z'),
          departureTz: 'America/New_York',
          arrivalTz: 'Europe/London',
        },
        {
          departureTime: new Date('2025-06-02T20:00:00Z'),
          arrivalTime: new Date('2025-06-03T11:00:00Z'),
          departureTz: 'Europe/London',
          arrivalTz: 'Asia/Tokyo',
        },
      ],
    };
    const timeline = assembleTimeline(trip);

    const windows = recommendSleepWindows(timeline, 'America/New_York', 'Asia/Tokyo');

    expect(windows).toHaveLength(2);
    const layover = timeline.items.find((i) => i.kind === 'layover')!;
    for (const w of windows) {
      const overlapsLayover = w.start < layover.end && layover.start < w.end;
      expect(overlapsLayover).toBe(false);
    }
  });
});
