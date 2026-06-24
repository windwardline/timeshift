import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { parseFlightStatus } from '@/lib/flights/status';
import { createFlightClient } from '@/lib/flights/client';

// Live status for a near-term leg (spec §3). Session-gated; the badge only calls
// this for flights within ~48h. A missing key is a 503 and upstream trouble a
// 502 — the badge simply renders nothing in either case.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const flight = url.searchParams.get('flight')?.trim();
  const date = url.searchParams.get('date') ?? '';
  if (!flight || !DATE.test(date)) {
    return NextResponse.json({ error: 'A flight number and date are required.' }, { status: 400 });
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Flight lookup is not configured.' }, { status: 503 });
  }

  try {
    const raw = await createFlightClient(apiKey).flightStatus({ flight, date });
    return NextResponse.json({ status: parseFlightStatus(raw) });
  } catch (error) {
    console.error('[flights] status failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not reach the flight service.' }, { status: 502 });
  }
}
