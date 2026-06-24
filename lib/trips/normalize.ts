import { z } from 'zod';
import { toUtc } from '../engine/time';

// Validates raw trip-builder input and normalizes it for persistence (US-C1):
// local wall-times are converted to absolute UTC via the engine (Luxon), legs
// are sequenced in order, and a leg that lands before it departs is rejected.
// PURE — no DB, no network.

const segmentSchema = z.object({
  flightNumber: z.string().trim().min(1).optional(), // e.g. "BA 178" (from real-flight selection)
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
  flightNumber?: string;
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

// A normalized leg before it has a position in a trip (the route/trip assigns
// `sequence`). This is the unit the add-segment route validates.
export type NormalizedLeg = Omit<NormalizedSegment, 'sequence'>;

export type NormalizeSegmentResult =
  | { ok: true; data: NormalizedLeg }
  | { ok: false; error: string };

// Validate and UTC-normalize a single leg (US-C1). Shared by trip creation and
// the add-segment route so both enforce identical rules. PURE.
export function normalizeSegmentInput(raw: unknown): NormalizeSegmentResult {
  const parsed = segmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'That flight leg is missing required details — please re-check it.' };
  }

  const s = parsed.data;
  const leg: NormalizedLeg = {
    flightNumber: s.flightNumber,
    departureAirport: s.departureAirport,
    arrivalAirport: s.arrivalAirport,
    departureTime: toUtc(s.departureLocal, s.departureTz),
    arrivalTime: toUtc(s.arrivalLocal, s.arrivalTz),
    departureTz: s.departureTz,
    arrivalTz: s.arrivalTz,
    departureLat: s.departureLat,
    departureLng: s.departureLng,
    arrivalLat: s.arrivalLat,
    arrivalLng: s.arrivalLng,
  };

  if (Number.isNaN(leg.departureTime.getTime()) || Number.isNaN(leg.arrivalTime.getTime())) {
    return { ok: false, error: 'That date or time zone wasn’t valid — please re-check the leg.' };
  }
  if (leg.arrivalTime.getTime() <= leg.departureTime.getTime()) {
    return { ok: false, error: 'This leg arrives before it departs — check the times and zones.' };
  }

  return { ok: true, data: leg };
}

export function normalizeTripInput(raw: unknown): NormalizeResult {
  const parsed = tripSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please give the trip a name and at least one flight leg.' };
  }

  const segments: NormalizedSegment[] = [];
  for (const [i, rawLeg] of parsed.data.segments.entries()) {
    const leg = normalizeSegmentInput(rawLeg);
    if (!leg.ok) {
      return { ok: false, error: `Leg ${i + 1}: ${leg.error}` };
    }
    segments.push({ sequence: i, ...leg.data });
  }

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      destination: segments[segments.length - 1].arrivalTz,
      segments,
    },
  };
}
