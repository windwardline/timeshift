import { NextResponse } from 'next/server';
import { z } from 'zod';
import { answerQuestion, type CoachDeps } from '@/lib/ai/coach';
import { AdviceGenerationError } from '@/lib/ai/advice';
import { AdviceParseError } from '@/lib/ai/parse';
import { loadCorpus } from '@/lib/rag/corpus';
import { embedQuery } from '@/lib/rag/embed';
import { createGeminiClient } from '@/lib/ai/client';

// Server-only grounded coach endpoint (US-R, CLAUDE.md §13). The API key is read
// here, server-side, and never reaches the browser. Retrieval is semantic when a
// key is configured (embedQuery returns a vector) and falls back to lexical when
// not — so this route works keyless, returning extractive grounded answers.
// Refusal gate thresholds (AC-R2), each tuned to its retrieval path's score scale
// against the real KB:
//   - lexical (TF-IDF cosine): on-topic ~0.18–0.28, off-topic ~0–0.14  → 0.16
//   - semantic (embedding cosine): on-topic ~0.74–0.86, off-topic ~0.51 → 0.62
// Both overridable via env for tuning.
const THRESHOLDS = {
  semantic: Number(process.env.COACH_THRESHOLD_SEMANTIC ?? 0.62),
  lexical: Number(process.env.COACH_THRESHOLD_LEXICAL ?? 0.16),
};

const bodySchema = z.object({ question: z.string().trim().min(1) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A non-empty question is required' }, { status: 400 });
  }

  const deps: CoachDeps = {
    embedQuery,
    generate: buildGenerate(),
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

// With a key, the answer is LLM-generated. Without one, it is composed
// extractively from the retrieved context already embedded in the prompt — so
// the feature stays fully keyless (the Sources, the real grounding proof, are
// identical either way; the key only upgrades the prose).
function buildGenerate(): (prompt: string) => Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const client = createGeminiClient(apiKey);
    return (prompt) => client.complete(prompt);
  }
  // Keyless: compose { answer, followUp } extractively from the prompt's context.
  return async (prompt) => JSON.stringify(extractiveResponse(prompt));
}

// Build a keyless { answer, followUp } from the retrieved passages embedded in the
// grounded prompt's Context block. The answer quotes the top passages; the
// follow-up points at the next retrieved topic — both grounded, no model call.
function extractiveResponse(prompt: string): { answer: string; followUp: string } {
  const context = prompt.split('Context:\n')[1]?.split('\n\nQuestion:')[0] ?? '';
  const blocks = context
    .split('\n\n')
    .map((block) => ({
      heading: /—\s*([^\]]+)\]/.exec(block)?.[1]?.trim() ?? '',
      text: block.replace(/^\[Source:[^\]]*\]\n?/, '').trim(),
    }))
    .filter((b) => b.text);

  const answer = blocks.length
    ? `From TimeShift's jetlag knowledge base: ${blocks.slice(0, 2).map((b) => b.text).join(' ')}`
    : '';
  const next = blocks[2] ?? blocks[1];
  const followUp = next?.heading ? `A natural next step: read up on “${next.heading}.”` : '';
  return { answer, followUp };
}
