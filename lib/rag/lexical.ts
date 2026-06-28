import type { Chunk, ScoredChunk } from './types';

// Lexical retrieval (US-R / AC-R4): the keyless fallback used when no embedder is
// configured. Scores each chunk by TF-IDF cosine similarity to the query — a
// bounded [0,1] similarity, directly comparable to the embedding-cosine semantic
// path, so a single refusal threshold gates both (AC-R2). PURE term math, no I/O.
//
// A small stopword set is filtered out so a query carrying no real content words
// (e.g. "the on") scores 0 everywhere rather than matching on filler.
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for', 'from', 'how',
  'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'should', 'so',
  'the', 'this', 'to', 'was', 'what', 'when', 'why', 'will', 'with', 'you', 'your',
]);

export function searchLexical(query: string, chunks: Chunk[], k: number): ScoredChunk[] {
  const docs = chunks.map((c) => tokenize(c.text));
  const N = chunks.length || 1;

  // Document frequency over every corpus term, for IDF weighting.
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = (term: string) => Math.log(1 + N / (1 + (df.get(term) ?? 0)));

  const queryVec = tfidfVector(tokenize(query), idf);

  const scored: ScoredChunk[] = chunks.map((chunk, i) => ({
    ...chunk,
    score: cosine(queryVec, tfidfVector(docs[i], idf)),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// Lowercase, split on non-alphanumeric runs, drop empties and stopwords.
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

// Sparse TF-IDF vector: term -> (termFrequency * idf).
function tfidfVector(tokens: string[], idf: (t: string) => number): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [term, freq] of tf) vec.set(term, freq * idf(term));
  return vec;
}

// Cosine similarity between two sparse vectors; 0 when either is empty.
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [term, weight] of a) dot += weight * (b.get(term) ?? 0);
  const magA = magnitude(a);
  const magB = magnitude(b);
  return magA === 0 || magB === 0 ? 0 : dot / (magA * magB);
}

function magnitude(v: Map<string, number>): number {
  let sum = 0;
  for (const weight of v.values()) sum += weight * weight;
  return Math.sqrt(sum);
}
