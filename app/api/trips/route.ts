import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createTrip } from '@/lib/db/trips';
import { normalizeTripInput } from '@/lib/trips/normalize';

// Create a trip from builder input (US-B1/C1). Validation + UTC normalization is
// the pure normalizeTripInput; persistence is the thin createTrip. No auth yet
// (Phase 7), so trips belong to the demo user, created on first use.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const result = normalizeTripInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email: 'demo@timeshift.app' },
    update: {},
    create: {
      email: 'demo@timeshift.app',
      passwordHash: 'placeholder-not-a-real-hash',
      homeTimeZone: 'America/New_York',
    },
  });

  const trip = await createTrip({ ...result.data, userId: user.id });
  return NextResponse.json({ id: trip.id }, { status: 201 });
}
