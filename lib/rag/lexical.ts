import type { Chunk, ScoredChunk } from './types';

// BM25-lite lexical retrieval (US-R / AC-R4): the keyless fallback used when no
// embedder is configured. PURE term-frequency math — no I/O. Returns chunks
// scored against the query, sorted descending, capped at k.
const K1 = 1.5; // term-frequency saturation
const B = 0.75; // length-normalization strength

export function searchLexical(query: string, chunks: Chunk[], k: number): ScoredChunk[] {
  const queryTerms = new Set(tokenize(query));
  const docs = chunks.map((c) => tokenize(c.text));
  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / (docs.length || 1);

  // Document frequency per query term: how many chunks contain it.
  const df = new Map<string, number>();
  for (const term of queryTerms) {
    df.set(term, docs.filter((d) => d.includes(term)).length);
  }

  const N = chunks.length;
  const scored: ScoredChunk[] = chunks.map((chunk, i) => {
    const tokens = docs[i];
    let score = 0;
    for (const term of queryTerms) {
      const tf = tokens.filter((t) => t === term).length;
      if (tf === 0) continue;
      const idf = Math.log(1 + (N - df.get(term)! + 0.5) / (df.get(term)! + 0.5));
      const norm = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + (B * tokens.length) / avgLen);
      score += idf * (norm / denom);
    }
    return { ...chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// Lowercase, split on any non-alphanumeric run, drop empties.
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
