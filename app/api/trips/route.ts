import { NextResponse } from 'next/server';
import { createTrip, listTrips } from '@/lib/db/trips';
import { normalizeTripInput } from '@/lib/trips/normalize';
import { getCurrentUser } from '@/lib/auth/current-user';

// Create a trip from builder input (US-B1/C1). Requires a session; the trip is
// owned by the signed-in user. Validation + UTC normalization is the pure
// normalizeTripInput; persistence is the thin createTrip.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to save a trip.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = normalizeTripInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const trip = await createTrip({ ...result.data, userId: user.id });
  return NextResponse.json({ id: trip.id }, { status: 201 });
}

// List the signed-in user's trips (US-B2).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const trips = await listTrips(user.id);
  return NextResponse.json({ trips: trips.map((t) => ({ id: t.id, name: t.name, destination: t.destination })) });
}
