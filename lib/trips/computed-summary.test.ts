import { describe, it, expect } from 'vitest';
import { describeComputedFacts } from './computed-summary';

// The Jetlag Plan's signature: it is COMPUTED from the engine's facts for this
// itinerary. describeComputedFacts turns those facts into display chips that make
// that visible. PURE, client-safe (no engine/network imports).
describe('describeComputedFacts', () => {
  it('describes an eastward shift with one sleep window and a date-line crossing', () => {
    const chips = describeComputedFacts({
      offsetDeltaMinutes: 780,
      crossesDateLine: true,
      sleepWindows: [{ label: '21:00–01:00 Tokyo' }],
    });

    expect(chips).toEqual([
      '+13.0h eastward shift',
      'sleep 21:00–01:00 Tokyo',
      'crosses the Date Line',
    ]);
  });

  it('describes a westward shift with no sleep window and no date-line crossing', () => {
    const chips = describeComputedFacts({
      offsetDeltaMinutes: -600,
      crossesDateLine: false,
      sleepWindows: [],
    });

    expect(chips).toEqual(['-10.0h westward shift']);
  });

  it('summarizes multiple sleep windows as a count', () => {
    const chips = describeComputedFacts({
      offsetDeltaMinutes: 60,
      crossesDateLine: false,
      sleepWindows: [{ label: 'a' }, { label: 'b' }],
    });

    expect(chips).toEqual(['+1.0h eastward shift', '2 in-flight sleep windows']);
  });

  it('omits a direction word when there is no offset shift', () => {
    const chips = describeComputedFacts({
      offsetDeltaMinutes: 0,
      crossesDateLine: false,
      sleepWindows: [],
    });

    expect(chips).toEqual(['0.0h shift']);
  });
});
