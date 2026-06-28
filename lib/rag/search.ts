import type { Chunk, KbVector, ScoredChunk } from './types';

// Semantic retrieval (US-R / AC-R4): join precomputed KB vectors to their chunks
// by id, score each by cosine similarity to the query vector, return the top-k
// descending. PURE — the query vector is produced upstream by the (excluded)
// embedder shell; this module does no I/O.
export function searchByVector(
  queryVec: number[],
  kbVectors: KbVector[],
  chunks: Chunk[],
  k: number,
): ScoredChunk[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));

  const scored: ScoredChunk[] = [];
  for (const { id, vector } of kbVectors) {
    const chunk = byId.get(id);
    if (!chunk) continue; // orphan vector with no matching chunk — skip
    scored.push({ ...chunk, score: cosineSimilarity(queryVec, vector) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// Cosine similarity, guarded so a zero-magnitude vector yields 0 (never NaN).
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
