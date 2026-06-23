import { NextResponse } from 'next/server';
import { getTripWithSegments } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assembleTimeline } from '@/lib/engine/timeline';

// Return the engine's assembled timeline for an owned trip (P7.5 / US-D1). The
// trip is loaded ownership-scoped, so a non-owner gets a bare 404 (US-B4). The
// engine stays pure — this route is the thin DB → engine → JSON seam.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to view this trip.' }, { status: 401 });
  }

  const trip = await getTripWithSegments(id, user.id);
  if (!trip || trip.segments.length === 0) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  return NextResponse.json({ timeline: assembleTimeline(trip) });
}
