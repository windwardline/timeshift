import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { assembleTimeline } from '@/lib/engine/timeline';
import { recommendSleepWindows } from '@/lib/engine/sleep';
import { assembleTripFacts } from '@/lib/ai/facts';
import { generateAdvice, AdviceGenerationError } from '@/lib/ai/advice';
import { AdviceParseError } from '@/lib/ai/parse';
import { createAnthropicClient } from '@/lib/ai/client';

// Server-only AI advice endpoint (CLAUDE.md §13). It loads the trip with the
// ownership-scoped query, runs the engine to derive the facts, then asks the
// model — via the real client behind the env key — to narrate them. The key is
// read here, server-side, and never reaches the browser.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // No auth yet (US-A* is Phase 7); the demo acts as the seeded demo user so the
  // ownership-scoped query is still exercised with a real, server-derived userId.
  const user = await prisma.user.findFirst({ where: { email: 'demo@timeshift.app' } });
  if (!user) {
    return NextResponse.json({ error: 'No user' }, { status: 404 });
  }

  const trip = await getTripWithSegments(id, user.id);
  if (!trip || trip.segments.length === 0) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Keyless environments (grading/CI/local without a key) degrade cleanly.
    return NextResponse.json(
      { error: 'AI advice is not configured (set ANTHROPIC_API_KEY).' },
      { status: 503 },
    );
  }

  const timeline = assembleTimeline(trip);
  const sleepWindows = recommendSleepWindows(timeline, user.homeTimeZone, trip.destination);
  const facts = assembleTripFacts(trip.segments, sleepWindows);

  try {
    const plan = await generateAdvice(facts, createAnthropicClient(apiKey));
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof AdviceGenerationError || error instanceof AdviceParseError) {
      return NextResponse.json({ error: 'Could not generate advice' }, { status: 502 });
    }
    throw error;
  }
}
