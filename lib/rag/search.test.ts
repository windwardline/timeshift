import { describe, it, expect } from 'vitest';
import { searchByVector } from './search';
import type { Chunk, KbVector } from './types';

// AC-R4 (semantic path): searchByVector joins precomputed KB vectors to their
// chunks by id, scores each by cosine similarity to the query vector, and
// returns the top-k. PURE math over hand-built fixture vectors — no embedder.
const chunks: Chunk[] = [
  { id: 'd#0', docId: 'd.md', heading: 'aligned', text: 'aligned' },
  { id: 'd#1', docId: 'd.md', heading: 'orthogonal', text: 'orthogonal' },
  { id: 'd#2', docId: 'd.md', heading: 'diagonal', text: 'diagonal' },
];

describe('searchByVector', () => {
  it('ranks the chunk whose vector is most aligned with the query first', () => {
    const vectors: KbVector[] = [
      { id: 'd#0', vector: [1, 0] }, // cosine 1 with [1,0]
      { id: 'd#1', vector: [0, 1] }, // cosine 0
      { id: 'd#2', vector: [1, 1] }, // cosine ~0.707
    ];

    const results = searchByVector([1, 0], vectors, chunks, 3);

    expect(results.map((r) => r.id)).toEqual(['d#0', 'd#2', 'd#1']);
    expect(results[0].score).toBeCloseTo(1, 5);
    expect(results[1].score).toBeCloseTo(0.7071, 3);
  });

  it('sorts descending by score and caps the result at k', () => {
    const vectors: KbVector[] = [
      { id: 'd#0', vector: [1, 0] },
      { id: 'd#1', vector: [0, 1] },
      { id: 'd#2', vector: [1, 1] },
    ];

    const results = searchByVector([1, 0], vectors, chunks, 2);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(['d#0', 'd#2']);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  it('scores a zero-magnitude vector as 0 without producing NaN', () => {
    const vectors: KbVector[] = [{ id: 'd#0', vector: [0, 0] }];

    const [result] = searchByVector([1, 0], vectors, chunks, 1);

    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('skips a KbVector with no matching chunk id', () => {
    const vectors: KbVector[] = [
      { id: 'orphan', vector: [1, 0] },
      { id: 'd#1', vector: [0, 1] },
    ];

    const results = searchByVector([1, 0], vectors, chunks, 5);

    expect(results.map((r) => r.id)).toEqual(['d#1']);
  });
});
