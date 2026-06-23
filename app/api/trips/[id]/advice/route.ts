import { NextResponse } from 'next/server';
import { getTripWithOwner } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assembleTimeline } from '@/lib/engine/timeline';
import { recommendSleepWindows } from '@/lib/engine/sleep';
import { assembleTripFacts } from '@/lib/ai/facts';
import { generateAdvice, AdviceGenerationError } from '@/lib/ai/advice';
import { AdviceParseError } from '@/lib/ai/parse';
import { createOpenAiClient } from '@/lib/ai/client';

// The public showcase trip is open to everyone; every other trip is owner-only.
const SHOWCASE_EMAIL = 'demo@timeshift.app';

// Server-only AI advice endpoint (CLAUDE.md §13). Loads the trip, enforces
// access, runs the engine to derive the facts, then asks the model — via the
// real client behind the env key — to narrate them.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const trip = await getTripWithOwner(id);
  if (!trip || trip.segments.length === 0) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  // Access control (US-B4): non-owners of a private trip get a bare 404 — no
  // data, no hint the trip exists.
  const viewer = await getCurrentUser();
  const isShowcase = trip.user.email === SHOWCASE_EMAIL;
  if (!isShowcase && trip.userId !== viewer?.id) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI advice is not configured (set OPENAI_API_KEY).' },
      { status: 503 },
    );
  }

  const timeline = assembleTimeline(trip);
  const homeTz = trip.segments[0].departureTz; // "home" is the journey's origin
  const sleepWindows = recommendSleepWindows(timeline, homeTz, trip.destination);
  const facts = assembleTripFacts(trip.segments, sleepWindows);

  try {
    const plan = await generateAdvice(facts, createOpenAiClient(apiKey));
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof AdviceGenerationError || error instanceof AdviceParseError) {
      // Server-side visibility for the failure (no key, no client exposure).
      console.error('[ai] advice failed:', error.message, '| cause:', error.cause);
      return NextResponse.json({ error: 'Could not generate advice' }, { status: 502 });
    }
    throw error;
  }
}
