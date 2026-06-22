import { z } from 'zod';
import { toUtc } from '../engine/time';

// Validates raw trip-builder input and normalizes it for persistence (US-C1):
// local wall-times are converted to absolute UTC via the engine (Luxon), legs
// are sequenced in order, and a leg that lands before it departs is rejected.
// PURE — no DB, no network.

const segmentSchema = z.object({
  departureAirport: z.string().trim().min(3).max(4),
  arrivalAirport: z.string().trim().min(3).max(4),
  departureLocal: z.string().min(1), // 'YYYY-MM-DDTHH:mm' wall time at the airport
  arrivalLocal: z.string().min(1),
  departureTz: z.string().min(1),
  arrivalTz: z.string().min(1),
  departureLat: z.number().optional(),
  departureLng: z.number().optional(),
  arrivalLat: z.number().optional(),
  arrivalLng: z.number().optional(),
});

const tripSchema = z.object({
  name: z.string().trim().min(1),
  segments: z.array(segmentSchema).min(1),
});

export interface NormalizedSegment {
  sequence: number;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  departureTz: string;
  arrivalTz: string;
  departureLat?: number;
  departureLng?: number;
  arrivalLat?: number;
  arrivalLng?: number;
}

export interface NormalizedTrip {
  name: string;
  destination: string; // IANA tz of the final arrival
  segments: NormalizedSegment[];
}

export type NormalizeResult =
  | { ok: true; data: NormalizedTrip }
  | { ok: false; error: string };

export function normalizeTripInput(raw: unknown): NormalizeResult {
  // Red stub: always fails so the happy-path test fails on assertion, not on a
  // missing import. Replaced with real validation + normalization in Green.
  void raw;
  void tripSchema;
  void toUtc;
  return { ok: false, error: 'not implemented' };
}
