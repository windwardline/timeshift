// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Timeline } from './Timeline';

// P8.1/P8.2 (US-D1/D2/D3): the timeline renders one bar per flight, a layover
// block for each gap, and day/night arcs — all positioned by the SAME
// time-to-x scale. The arc sharing a flight's exact span must land at the same
// x/width as that flight's bar (the scale is shared, not duplicated).

const d = (iso: string) => new Date(iso);

const flights = [
  { departureAirport: 'JFK', arrivalAirport: 'LHR', departureTime: d('2025-07-02T01:30:00Z'), arrivalTime: d('2025-07-02T08:20:00Z'), flightNumber: 'BA 178' },
  { departureAirport: 'LHR', arrivalAirport: 'SIN', departureTime: d('2025-07-02T10:40:00Z'), arrivalTime: d('2025-07-02T23:30:00Z'), flightNumber: 'BA 11' },
];
const layovers = [{ start: d('2025-07-02T08:20:00Z'), end: d('2025-07-02T10:40:00Z') }];
// The first (day) arc spans exactly the first flight, so its x/width must match.
const arcs = [
  { kind: 'day' as const, start: d('2025-07-02T01:30:00Z'), end: d('2025-07-02T08:20:00Z') },
  { kind: 'night' as const, start: d('2025-07-02T08:20:00Z'), end: d('2025-07-02T23:30:00Z') },
];

function renderTimeline() {
  return render(
    <Timeline
      axisStart={d('2025-07-02T01:30:00Z')}
      axisEnd={d('2025-07-02T23:30:00Z')}
      flights={flights}
      layovers={layovers}
      arcs={arcs}
      sleep={[]}
      destTz="Asia/Singapore"
    />,
  );
}

describe('Timeline', () => {
  it('renders one bar per flight', () => {
    const { container } = renderTimeline();
    const flightBars = container.querySelectorAll('rect[fill="url(#g-flight)"]');
    expect(flightBars).toHaveLength(2);
  });

  it('renders a layover block for the ground gap', () => {
    const { container } = renderTimeline();
    // The layover block is the hatch-filled rect between the two flights.
    expect(container.querySelectorAll('rect[fill="url(#hatch)"]')).toHaveLength(1);
  });

  it('renders day and night arcs', () => {
    const { container } = renderTimeline();
    expect(container.querySelectorAll('rect[fill="url(#g-day)"]')).toHaveLength(1);
    expect(container.querySelectorAll('rect[fill="url(#g-night)"]')).toHaveLength(1);
  });

  it('positions an arc on the same scale as the flight it shares a span with', () => {
    const { container } = renderTimeline();
    const dayArc = container.querySelector('rect[fill="url(#g-day)"]')!;
    const firstFlight = container.querySelector('rect[fill="url(#g-flight)"]')!;
    expect(dayArc.getAttribute('x')).toBe(firstFlight.getAttribute('x'));
    expect(dayArc.getAttribute('width')).toBe(firstFlight.getAttribute('width'));
  });
});
