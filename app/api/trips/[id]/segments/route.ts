import { NextResponse } from 'next/server';
import { getTripWithSegments, appendSegment } from '@/lib/db/trips';
import { normalizeSegmentInput } from '@/lib/trips/normalize';
import { getCurrentUser } from '@/lib/auth/current-user';

// Append a flight leg to an owned trip (P7.4 / US-C1+C2). Requires a session;
// the trip is loaded ownership-scoped so a non-owner simply gets a 404 (US-B4).
// The leg is UTC-normalized by the shared pure validator and appended at the
// next sequence.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to edit a trip.' }, { status: 401 });
  }

  const trip = await getTripWithSegments(id, user.id);
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = normalizeSegmentInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const segment = await appendSegment(id, { sequence: trip.segments.length, ...result.data });
  return NextResponse.json({ id: segment.id }, { status: 201 });
}
