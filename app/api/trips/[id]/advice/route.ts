import { NextResponse } from 'next/server';
import { getTripWithOwner } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assembleTimeline } from '@/lib/engine/timeline';
import { recommendSleepWindows } from '@/lib/engine/sleep';
import { assembleTripFacts } from '@/lib/ai/facts';
import { generateAdvice, AdviceGenerationError } from '@/lib/ai/advice';
import { AdviceParseError } from '@/lib/ai/parse';
import { createGeminiClient } from '@/lib/ai/client';
import { consume } from '@/lib/ratelimit/limit';
import { LIMITS, clientIp } from '@/lib/ratelimit/config';
import { tooManyRequests } from '@/lib/ratelimit/response';

// The public showcase trip is open to everyone; every other trip is owner-only.
const SHOWCASE_EMAIL = 'demo@timeshift.app';

// Server-only AI advice endpoint (AGENTS.md §13). Loads the trip, enforces
// access, runs the engine to derive the facts, then asks the model — via the
// real client behind the env key — to narrate them.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const trip = await getTripWithOwner(id);
  if (!trip || trip.segments.length === 0) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  // Access control (US-B4): non-owners of a private trip get a bare 404 — no
  // data, no hint the trip exists.
  const viewer = await getCurrentUser();
  const isShowcase = trip.user.email === SHOWCASE_EMAIL;
  const isOwner = trip.userId === viewer?.id;
  if (!isShowcase && !isOwner) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI advice is not configured (set GEMINI_API_KEY).' },
      { status: 503 },
    );
  }

  // Only the open path is counted (#71). Reaching here as a non-owner means the
  // showcase trip, which any anonymous caller may ask about — and each ask is a
  // generation on the owner's GCP project. An owner is already bounded by having
  // had to sign in, so their own trips are not rate-limited.
  //
  // Counted AFTER the key check, matching /api/auth/request-link: a deployment
  // without GEMINI_API_KEY 503s without spending anything upstream, so charging
  // the caller for it would hand real visitors 429s for a limit they never hit.
  // (/api/coach is counted before its key check on purpose — it answers keyless
  // through the lexical fallback, so a keyless call there is real work.)
  if (!isOwner) {
    const rate = await consume({ bucket: 'advice', subject: clientIp(request), ...LIMITS.advice });
    if (!rate.allowed) return tooManyRequests(rate.retryAfter);
  }

  const timeline = assembleTimeline(trip);
  const homeTz = trip.segments[0].departureTz; // "home" is the journey's origin
  const sleepWindows = recommendSleepWindows(timeline, homeTz, trip.destination);
  const facts = assembleTripFacts(trip.segments, sleepWindows);

  try {
    const plan = await generateAdvice(facts, createGeminiClient(apiKey));
    // Return the engine-computed facts alongside the plan so the client can show
    // what the plan was computed from — the Jetlag Plan's "your itinerary,
    // computed" signature. `facts` are deterministic engine output, not the model.
    return NextResponse.json({ ...plan, facts });
  } catch (error) {
    if (error instanceof AdviceGenerationError || error instanceof AdviceParseError) {
      // Server-side visibility for the failure (no key, no client exposure).
      console.error('[ai] advice failed:', error.message, '| cause:', error.cause);
      return NextResponse.json({ error: 'Could not generate advice' }, { status: 502 });
    }
    throw error;
  }
}
