import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { validateSearchParams } from '@/lib/flights/validate';
import { parseFlights } from '@/lib/flights/parse';
import { sortFlights } from '@/lib/flights/sort';
import { readCache, writeCache } from '@/lib/flights/cache';
import { createFlightClient } from '@/lib/flights/client';
import type { SortKey } from '@/lib/flights/types';

// Search real flights by route + date (spec §3). Session-gated to protect the
// key and quota. Params are validated before any upstream call; a fresh cache
// entry short-circuits the network. Upstream trouble becomes a 502, a missing
// key a 503 — the UI falls back to manual entry either way.
const SORT_KEYS: SortKey[] = ['departure', 'arrival', 'duration'];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to search flights.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = validateSearchParams({
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
  });
  if (!params.ok) {
    return NextResponse.json({ error: params.error }, { status: 400 });
  }

  const sortParam = url.searchParams.get('sort');
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'departure';
  const { from, to, date } = params.data;
  const key = `${from}:${to}:${date}`;

  const cached = await readCache(key);
  if (cached) {
    return NextResponse.json({ flights: sortFlights(cached, sort) });
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Flight lookup is not configured.' }, { status: 503 });
  }

  try {
    const raw = await createFlightClient(apiKey).searchFlights({ from, to, date });
    const flights = sortFlights(parseFlights(raw), sort);
    await writeCache(key, flights);
    return NextResponse.json({ flights });
  } catch (error) {
    console.error('[flights] search failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not reach the flight service.' }, { status: 502 });
  }
}
