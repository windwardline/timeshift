import { describe, it, expect } from 'vitest';
import { buildAdvicePrompt } from './prompt';
import type { TripFacts } from './facts';

// AI-1 / AC-F1.1: the prompt must carry the engine's hard facts so the model
// narrates them rather than inventing them. A NY -> Tokyo red-eye: Tokyo is 13h
// ahead (+780 min), with one in-flight sleep window. The built prompt must
// contain the origin and destination zones, the timezone delta, and the
// sleep-window times.
describe('buildAdvicePrompt', () => {
  it('embeds the timezone delta, both zones, and sleep-window times', () => {
    const facts: TripFacts = {
      originZone: 'America/New_York',
      destinationZone: 'Asia/Tokyo',
      offsetDeltaMinutes: 780,
      crossesDateLine: false,
      sleepWindows: [
        {
          startUtc: '2025-06-02T10:00:00Z',
          endUtc: '2025-06-02T14:00:00Z',
          label: '21:00–01:00 Tokyo',
        },
      ],
    };

    const prompt = buildAdvicePrompt(facts);

    expect(prompt).toContain('America/New_York');
    expect(prompt).toContain('Asia/Tokyo');
    expect(prompt).toContain('780');
    expect(prompt).toContain('2025-06-02T10:00:00Z');
  });

  // AC-F1.1 (branch coverage): the prompt adapts to trip shape. A westward
  // Tokyo -> LA hop reads as "behind" origin, an empty sleep plan as "none
  // recommended", and the date-line crossing is flagged — pinning the branches
  // buildAdvicePrompt added for the live prompt.
  it('describes a westward, date-line-crossing trip with no sleep window', () => {
    const westward: TripFacts = {
      originZone: 'Asia/Tokyo',
      destinationZone: 'America/Los_Angeles',
      offsetDeltaMinutes: -1020,
      crossesDateLine: true,
      sleepWindows: [],
    };

    const prompt = buildAdvicePrompt(westward);

    expect(prompt).toContain('behind origin');
    expect(prompt).toContain('none recommended');
    expect(prompt).toContain('International Date Line: yes');
  });
});
