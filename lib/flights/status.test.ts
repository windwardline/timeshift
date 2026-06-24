import { describe, it, expect } from 'vitest';
import { parseFlightStatus } from './status';

// Maps AviationStack `/flights` JSON into a FlightStatus for the near-term live
// badge (spec §4). A positive departure delay surfaces as `delayed` with minutes;
// known statuses map through; anything else (or malformed) is `unknown`.

const withStatus = (flight_status: string, delay: number | null = null) => ({
  data: [{ flight_status, departure: { delay } }],
});

describe('parseFlightStatus', () => {
  it('maps known statuses', () => {
    expect(parseFlightStatus(withStatus('scheduled'))).toEqual({ state: 'scheduled', delayMinutes: null });
    expect(parseFlightStatus(withStatus('active'))).toEqual({ state: 'active', delayMinutes: null });
    expect(parseFlightStatus(withStatus('landed'))).toEqual({ state: 'landed', delayMinutes: null });
    expect(parseFlightStatus(withStatus('cancelled'))).toEqual({ state: 'cancelled', delayMinutes: null });
  });

  it('surfaces a positive delay as the delayed state with minutes', () => {
    expect(parseFlightStatus(withStatus('active', 35))).toEqual({ state: 'delayed', delayMinutes: 35 });
  });

  it('treats unknown statuses and malformed input as unknown', () => {
    expect(parseFlightStatus(withStatus('diverted'))).toEqual({ state: 'unknown', delayMinutes: null });
    expect(parseFlightStatus(null)).toEqual({ state: 'unknown', delayMinutes: null });
    expect(parseFlightStatus({})).toEqual({ state: 'unknown', delayMinutes: null });
    expect(parseFlightStatus({ data: [] })).toEqual({ state: 'unknown', delayMinutes: null });
    // present entry, but no (string) status and no delay → unknown
    expect(parseFlightStatus({ data: [{ departure: {} }] })).toEqual({ state: 'unknown', delayMinutes: null });
  });
});
