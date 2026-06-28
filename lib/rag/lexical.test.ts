import { describe, it, expect } from 'vitest';
import { searchLexical } from './lexical';
import type { Chunk } from './types';

// AC-R4 (fallback path): when no embedder is configured, retrieval falls back to
// BM25-lite lexical scoring so the coach still works keyless. PURE term math over
// inline fixture corpora.
const corpus: Chunk[] = [
  { id: 'c0', docId: 'melatonin.md', heading: 'h', text: 'melatonin helps shift the body clock' },
  { id: 'c1', docId: 'water.md', heading: 'h', text: 'drink water on the plane' },
  { id: 'c2', docId: 'light.md', heading: 'h', text: 'morning sunlight anchors the body clock' },
];

describe('searchLexical', () => {
  it('ranks the chunk sharing the query term first', () => {
    const results = searchLexical('melatonin', corpus, 3);

    expect(results[0].id).toBe('c0');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('tokenizes case-insensitively and ignores punctuation', () => {
    const results = searchLexical('MELATONIN!!!', corpus, 3);

    expect(results[0].id).toBe('c0');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('lets a rare term outrank a common one (IDF effect)', () => {
    const idfCorpus: Chunk[] = [
      { id: 'r', docId: 'r.md', heading: 'h', text: 'rare alpha' },
      { id: 'a', docId: 'a.md', heading: 'h', text: 'common beta' },
      { id: 'b', docId: 'b.md', heading: 'h', text: 'common gamma' },
      { id: 'c', docId: 'c.md', heading: 'h', text: 'common delta' },
    ];

    const results = searchLexical('rare common', idfCorpus, 4);
    const rare = results.find((r) => r.id === 'r')!;
    const common = results.find((r) => r.id === 'a')!;

    expect(results[0].id).toBe('r');
    expect(rare.score).toBeGreaterThan(common.score);
  });

  it('scores every chunk 0 when no query term overlaps the corpus', () => {
    const results = searchLexical('zzz nonexistent', corpus, 3);

    expect(results.every((r) => r.score === 0)).toBe(true);
  });
});
