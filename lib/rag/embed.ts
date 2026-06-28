/* v8 ignore file */
// Network shell for query embedding (US-R, CLAUDE.md §13). The ONLY module in
// lib/rag that touches the network/SDK — never unit-tested, explicitly excluded
// from coverage, mirroring lib/ai/client.ts. Returns null when no key is
// configured so the orchestrator falls back to the keyless lexical (BM25) path.
import { GoogleGenAI } from '@google/genai';

// Verified via context7 (@google/genai → googleapis/js-genai) on 2026-06-28:
// ai.models.embedContent({ model, contents, config: { outputDimensionality } })
// resolves to response.embeddings[i].values (number[]). `gemini-embedding-001`
// is the current GA text-embedding model; we pin 768 dims so the live query
// vector and the precomputed KB vectors share a comparable space.
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? 'gemini-embedding-001';
export const EMBED_DIM = 768;

export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null; // keyless → caller uses the lexical fallback

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIM },
  });
  return response.embeddings?.[0]?.values ?? null;
}
