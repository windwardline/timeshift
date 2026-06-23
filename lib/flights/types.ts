// Shared contract for the AviationStack flight-selection feature. Pure types —
// no runtime, no network. The network client returns raw JSON; the pure parser
// (lib/flights/parse.ts) maps it into these shapes, which the routes and UI use.

// One selectable flight, normalized for the trip builder. Local times are wall
// times at each airport (the builder re-normalizes them to UTC via the engine).
export interface FlightOption {
  flightNumber: string; // "BA 178"
  airlineName: string | null;
  departureIata: string; // "JFK"
  arrivalIata: string; // "LHR"
  departureLocal: string; // "YYYY-MM-DDTHH:mm" wall time at the departure airport
  arrivalLocal: string; // "YYYY-MM-DDTHH:mm" wall time at the arrival airport
  departureTz: string; // IANA, from the API
  arrivalTz: string; // IANA, from the API
  departureTerminal: string | null;
  arrivalTerminal: string | null;
  durationMinutes: number; // true elapsed minutes (from the UTC instants)
}

export type SortKey = 'departure' | 'arrival' | 'duration';

export type FlightState = 'scheduled' | 'active' | 'landed' | 'cancelled' | 'delayed' | 'unknown';

// Live status for a near-term leg (within the 48h window).
export interface FlightStatus {
  state: FlightState;
  delayMinutes: number | null;
}
