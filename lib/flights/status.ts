import type { FlightStatus, FlightState } from './types';

// Map AviationStack `/flights` JSON into a FlightStatus for the near-term live
// badge. PURE and defensive: a positive departure delay wins as `delayed`;
// otherwise a known status maps through; anything else is `unknown`.

const KNOWN: Record<string, FlightState> = {
  scheduled: 'scheduled',
  active: 'active',
  landed: 'landed',
  cancelled: 'cancelled',
};

const UNKNOWN: FlightStatus = { state: 'unknown', delayMinutes: null };

export function parseFlightStatus(raw: unknown): FlightStatus {
  const entry = (raw as { data?: unknown } | null)?.data;
  const first = Array.isArray(entry) ? entry[0] : undefined;
  if (!first || typeof first !== 'object') return UNKNOWN;

  const record = first as { flight_status?: unknown; departure?: { delay?: unknown } };
  const delay = record.departure?.delay;
  if (typeof delay === 'number' && delay > 0) {
    return { state: 'delayed', delayMinutes: delay };
  }

  const status = typeof record.flight_status === 'string' ? KNOWN[record.flight_status] : undefined;
  return status ? { state: status, delayMinutes: null } : UNKNOWN;
}
