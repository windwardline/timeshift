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
// Refusal gate threshold (AC-R2), tuned against the KB on the keyless lexical
// (TF-IDF cosine) path: on-topic questions score ~0.18–0.28, off-topic ~0–0.14,
// so 0.16 separates them. The denser embedding-cosine semantic path rarely dips
// this low, so when a key is present the LLM's grounding instruction does the
// fine-grained refusal; raise COACH_THRESHOLD to harden the semantic pre-gate.
const COACH_THRESHOLD = Number(process.env.COACH_THRESHOLD ?? 0.16);

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
    threshold: COACH_THRESHOLD,
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
  return async (prompt) => JSON.stringify({ answer: extractiveAnswer(prompt) });
}

// Pull the retrieved passage text out of the grounded prompt's Context block,
// dropping the `[Source: …]` labels, to form a keyless extractive answer.
function extractiveAnswer(prompt: string): string {
  const context = prompt.split('Context:\n')[1]?.split('\n\nQuestion:')[0] ?? '';
  const passages = context
    .split('\n\n')
    .map((block) => block.replace(/^\[Source:[^\]]*\]\n?/, '').trim())
    .filter(Boolean);
  return `From TimeShift's jetlag knowledge base: ${passages.join(' ')}`;
}
