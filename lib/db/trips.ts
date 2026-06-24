import { prisma } from './prisma';

// Thin persistence layer for trips. Per CLAUDE.md §4/§5 the database owns
// persistence and the engine owns the time reasoning: these functions just
// move rows in and out. Timestamps are persisted in UTC (`DateTime`) with the
// original IANA zone string stored alongside, so all offset/DST math stays
// delegated to Luxon inside lib/engine/.

export interface NewSegmentInput {
  sequence: number; // 0-based order within the trip; the ordering source of truth
  flightNumber?: string; // e.g. "BA 178" — shown on the timeline; enables live status
  departureAirport: string; // IATA, e.g. "JFK"
  arrivalAirport: string; // IATA, e.g. "LHR"
  departureTime: Date; // UTC instant
  arrivalTime: Date; // UTC instant
  departureTz: string; // IANA tz, e.g. "America/New_York"
  arrivalTz: string; // IANA tz, e.g. "Europe/London"
  departureLat?: number;
  departureLng?: number;
  arrivalLat?: number;
  arrivalLng?: number;
}

export interface NewTripInput {
  name: string;
  destination: string; // IANA tz of the destination
  userId: string; // owner
  segments: NewSegmentInput[];
}

// Segments are always returned in ascending `sequence` so the engine receives a
// clean, ordered list of legs (assembleTimeline assumes pre-ordered input).
const orderedSegments = { segments: { orderBy: { sequence: 'asc' } } } as const;

// Insert a Trip together with its FlightSegments in one nested write.
export function createTrip(input: NewTripInput) {
  return prisma.trip.create({
    data: {
      name: input.name,
      destination: input.destination,
      userId: input.userId,
      segments: { create: input.segments },
    },
    include: orderedSegments,
  });
}

// Append one already-normalized leg to a trip (P7.4). The caller supplies the
// sequence (next position); the leg is persisted as a child of the trip.
export function appendSegment(tripId: string, leg: NewSegmentInput) {
  return prisma.flightSegment.create({ data: { tripId, ...leg } });
}

// The pipeline's input query: fetch one trip with all its segments ordered by
// sequence, scoped to its owner so the database itself enforces access control
// (US-B4) — callers pass a session-derived userId, never a client-supplied one.
// This single ownership-scoped, ordered `include` is what feeds the temporal
// engine: the join hands the engine a correctly ordered list of legs.
export function getTripWithSegments(id: string, userId: string) {
  return prisma.trip.findFirst({
    where: { id, userId },
    include: orderedSegments,
  });
}

// Unscoped load including the owner, for access decisions (the public showcase
// trip vs. an owned trip). Callers MUST enforce access before returning data.
export function getTripWithOwner(id: string) {
  return prisma.trip.findUnique({
    where: { id },
    include: { ...orderedSegments, user: true },
  });
}

// Rename a trip the caller owns (US-B3). Scoped write — `count` is 0 when the
// trip isn't the caller's, so the route can answer 404 without leaking existence.
export function renameTrip(id: string, userId: string, name: string) {
  return prisma.trip.updateMany({ where: { id, userId }, data: { name } });
}

// Delete a trip the caller owns (US-B3); cascades to its segments. Scoped like
// renameTrip so a non-owner's delete affects 0 rows.
export function deleteTrip(id: string, userId: string) {
  return prisma.trip.deleteMany({ where: { id, userId } });
}

// Edit one leg of an owned trip (US-C3). The relation filter on `trip.userId`
// enforces ownership in the write itself, so a non-owner affects 0 rows. The leg
// keeps its sequence; only the normalized flight fields change.
export function updateSegment(
  tripId: string,
  userId: string,
  segId: string,
  leg: Omit<NewSegmentInput, 'sequence'>,
) {
  return prisma.flightSegment.updateMany({
    where: { id: segId, tripId, trip: { userId } },
    data: { ...leg },
  });
}

// Delete one leg of an owned trip (US-C3), then compact the remaining legs to a
// contiguous 0-based sequence so the engine still receives a clean order. The
// delete is ownership-scoped via the trip relation; resequencing runs only when
// a row was actually removed.
export async function deleteSegment(tripId: string, userId: string, segId: string) {
  const removed = await prisma.flightSegment.deleteMany({
    where: { id: segId, tripId, trip: { userId } },
  });
  if (removed.count === 0) return removed;

  const remaining = await prisma.flightSegment.findMany({
    where: { tripId },
    orderBy: { sequence: 'asc' },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((s, i) => prisma.flightSegment.update({ where: { id: s.id }, data: { sequence: i } })),
  );
  return removed;
}

// List a user's trips, most recent first (US-B2).
export function listTrips(userId: string) {
  return prisma.trip.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: orderedSegments,
  });
}
