import { searchByVector } from '@/lib/rag/search';
import { searchLexical } from '@/lib/rag/lexical';
import { decideAnswerable } from '@/lib/rag/ground';
import type { Chunk, KbVector, SourceRef } from '@/lib/rag/types';
import { buildGroundedPrompt } from './prompt';
import { parseGroundedResponse } from './parse';
import { AdviceGenerationError } from './advice';

// Grounded jetlag coach orchestrator (US-R). PURE orchestration: every effectful
// dependency (the query embedder and the generation client) is injected, so this
// is unit-tested keyless with mocks (AC-R5). It wires the pure RAG units together:
// embed → retrieve (semantic, or lexical fallback) → gate → refuse-or-generate.

// How many chunks retrieval considers before the threshold gate trims them.
const TOP_K = 4;

// The honest refusal returned when retrieval does not clear the threshold (AC-R2).
export const REFUSAL =
  "I don't have anything in TimeShift's jetlag knowledge base that covers that question.";

export interface CoachDeps {
  embedQuery: (text: string) => Promise<number[] | null>;
  generate: (prompt: string) => Promise<string>; // the client wrapper; mocked in tests
  // `sources` maps a docId to its verifiable external citation (US-R, AC-R3).
  corpus: { chunks: Chunk[]; vectors: KbVector[]; sources: Record<string, SourceRef> };
  // Embedding-cosine and TF-IDF-cosine scores sit on different scales, so each
  // retrieval path is gated by its own refusal threshold (AC-R2).
  thresholds: { semantic: number; lexical: number };
}

export interface CoachResult {
  grounded: boolean;
  answer: string; // refusal message when grounded === false
  followUp: string; // the next-step nudge; '' when refused or absent
  sources: SourceRef[]; // verifiable external citations of the chunks used; [] when refused
}

export async function answerQuestion(query: string, deps: CoachDeps): Promise<CoachResult> {
  const { embedQuery, generate, corpus, thresholds } = deps;

  // Semantic only when there are precomputed KB vectors to match against AND an
  // embedding is available; otherwise (no vectors, or no embedder) fall back to
  // lexical. Embedding with an empty KB would just waste a call and retrieve
  // nothing, so we skip it entirely when corpus.vectors is empty.
  const queryVec = corpus.vectors.length > 0 ? await embedQuery(query) : null;
  const scored = queryVec
    ? searchByVector(queryVec, corpus.vectors, corpus.chunks, TOP_K)
    : searchLexical(query, corpus.chunks, TOP_K);

  // Gate with the threshold for the path that actually ran.
  const threshold = queryVec ? thresholds.semantic : thresholds.lexical;
  const decision = decideAnswerable(scored, threshold);
  if (!decision.answerable) {
    return { grounded: false, answer: REFUSAL, followUp: '', sources: [] };
  }

  const prompt = buildGroundedPrompt(query, decision.chunks);
  let raw: string;
  try {
    raw = await generate(prompt);
  } catch (cause) {
    throw new AdviceGenerationError('The coach provider call failed', { cause });
  }

  const { answer, followUp } = parseGroundedResponse(raw);
  // Citations are the verifiable external sources of exactly the docs the model
  // saw — never the internal filename, never anything the model invented (AC-R3).
  // Deduped by URL, since several KB docs can share one authoritative source; a
  // doc without a registered source is simply omitted.
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const chunk of decision.chunks) {
    const source = corpus.sources[chunk.docId];
    if (source && !seen.has(source.url)) {
      seen.add(source.url);
      sources.push(source);
    }
  }
  return { grounded: true, answer, followUp, sources };
}
