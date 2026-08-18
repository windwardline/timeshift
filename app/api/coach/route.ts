import { NextResponse } from 'next/server';
import { z } from 'zod';
import { answerQuestion, type CoachDeps } from '@/lib/ai/coach';
import { AdviceGenerationError } from '@/lib/ai/advice';
import { AdviceParseError } from '@/lib/ai/parse';
import { loadCorpus } from '@/lib/rag/corpus';
import { embedQuery } from '@/lib/rag/embed';
import { createGeminiClient } from '@/lib/ai/client';
import { makeCoachGenerate } from '@/lib/ai/coach-generate';
import { consume } from '@/lib/ratelimit/limit';
import { LIMITS, clientIp } from '@/lib/ratelimit/config';
import { tooManyRequests } from '@/lib/ratelimit/response';

// Server-only grounded coach endpoint (US-R, CLAUDE.md §13). The API key is read
// here, server-side, and never reaches the browser. Retrieval is semantic when a
// key is configured (embedQuery returns a vector) and falls back to lexical when
// not — so this route works keyless, returning extractive grounded answers.
// Refusal gate thresholds (AC-R2), each tuned to its retrieval path's score scale
// against the 55-doc KB:
//   - semantic (embedding cosine): on-topic ~0.75–0.82, off-topic ~0.49–0.52 → 0.62
//   - lexical (TF-IDF cosine): the weaker keyless fallback; off-topic can reach
//     ~0.2 on a large diverse corpus, so we gate conservatively at 0.25 (when in
//     doubt, refuse) — the semantic path does the precise separation.
// Both overridable via env for tuning.
const THRESHOLDS = {
  semantic: Number(process.env.COACH_THRESHOLD_SEMANTIC ?? 0.62),
  lexical: Number(process.env.COACH_THRESHOLD_LEXICAL ?? 0.25),
};

const bodySchema = z.object({ question: z.string().trim().min(1) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A non-empty question is required' }, { status: 400 });
  }

  // This route takes no session by design, and every answer costs an embedding
  // plus a generation on the owner's GCP project (#71). Counted after validation
  // so a malformed body cannot burn a caller's allowance.
  const rate = await consume({ bucket: 'coach', subject: clientIp(request), ...LIMITS.coach });
  if (!rate.allowed) return tooManyRequests(rate.retryAfter);

  const deps: CoachDeps = {
    embedQuery,
    generate: makeCoachGenerate({ apiKey: process.env.GEMINI_API_KEY, createClient: createGeminiClient }),
    corpus: loadCorpus(),
    thresholds: THRESHOLDS,
  };

  try {
    const result = await answerQuestion(parsed.data.question, deps);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdviceGenerationError || error instanceof AdviceParseError) {
      console.error('[coach] failed:', error.message, '| cause:', error.cause);
      return NextResponse.json({ error: 'Could not answer right now' }, { status: 502 });
    }
    throw error;
  }
}

