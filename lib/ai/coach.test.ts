import { describe, it, expect, vi } from 'vitest';
import { answerQuestion, REFUSAL, type CoachDeps } from './coach';
import { AdviceGenerationError } from './advice';
import type { Chunk, KbVector } from '@/lib/rag/types';

// US-R: answerQuestion ties the pure RAG units together. Every dependency is
// injected and mocked, so these tests are fully keyless (AC-R5) and exercise both
// retrieval paths plus the refusal gate (AC-R2) and source integrity (AC-R3).
const chunks: Chunk[] = [
  { id: 'east.md#0', docId: 'east.md', heading: 'advance', text: 'flying east phase advance' },
  { id: 'east.md#1', docId: 'east.md', heading: 'early', text: 'east is early' },
  { id: 'water.md#0', docId: 'water.md', heading: 'hydrate', text: 'drink water' },
];
const vectors: KbVector[] = [
  { id: 'east.md#0', vector: [1, 0] },
  { id: 'east.md#1', vector: [0.9, 0.1] },
  { id: 'water.md#0', vector: [0, 1] },
];

const baseDeps = (over: Partial<CoachDeps> = {}): CoachDeps => ({
  embedQuery: vi.fn().mockResolvedValue([1, 0]),
  generate: vi.fn().mockResolvedValue(JSON.stringify({ answer: 'Because the clock must advance.' })),
  corpus: { chunks, vectors },
  // Path-aware thresholds: semantic (embedding-cosine) and lexical (TF-IDF cosine)
  // sit on different scales, so each path is gated by its own value.
  thresholds: { semantic: 0.5, lexical: 0.5 },
  ...over,
});

describe('answerQuestion', () => {
  it('uses the semantic path when an embedding is available and returns deduped sources', async () => {
    const deps = baseDeps();

    const result = await answerQuestion('Why is flying east worse?', deps);

    expect(result.grounded).toBe(true);
    expect(result.answer).toBe('Because the clock must advance.');
    // east.md#0 and east.md#1 both pass threshold → a single deduped source.
    expect(result.sources).toEqual(['east.md']);
    expect(deps.embedQuery).toHaveBeenCalledWith('Why is flying east worse?');
  });

  it('falls back to the lexical path when the embedder returns null', async () => {
    const generate = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ answer: 'East travel advances the clock.' }));
    const deps = baseDeps({ embedQuery: vi.fn().mockResolvedValue(null), generate });

    const result = await answerQuestion('flying east', deps);

    expect(result.grounded).toBe(true);
    expect(result.answer).toBe('East travel advances the clock.');
    expect(result.sources).toEqual(['east.md']);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('uses the lexical path when the corpus has no precomputed vectors, even with an embedder', async () => {
    const embedQuery = vi.fn().mockResolvedValue([1, 0]);
    const generate = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ answer: 'East travel advances the clock.' }));
    const deps = baseDeps({ embedQuery, generate, corpus: { chunks, vectors: [] } });

    const result = await answerQuestion('flying east', deps);

    // No vectors to match against → skip embedding entirely and retrieve lexically.
    expect(embedQuery).not.toHaveBeenCalled();
    expect(result.grounded).toBe(true);
    expect(result.sources).toEqual(['east.md']);
  });

  it('refuses below the lexical threshold and never calls generate', async () => {
    const generate = vi.fn();
    const deps = baseDeps({ embedQuery: vi.fn().mockResolvedValue(null), generate });

    const result = await answerQuestion('zzz nonexistent topic', deps);

    expect(result).toEqual({ grounded: false, answer: REFUSAL, sources: [] });
    expect(generate).not.toHaveBeenCalled();
  });

  it('gates the semantic path with the semantic threshold', async () => {
    const generate = vi.fn();
    // Top cosine here is 1.0 (query [1,0] vs chunk [1,0]); a semantic threshold
    // above any achievable cosine refuses it, while lexical 0 (which would accept)
    // is irrelevant on this path — proving the semantic threshold is the one used.
    const deps = baseDeps({
      generate,
      thresholds: { semantic: 1.1, lexical: 0 },
    });

    const result = await answerQuestion('Why is flying east worse?', deps);

    expect(result.grounded).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it('surfaces a generation failure as a typed AdviceGenerationError', async () => {
    const deps = baseDeps({ generate: vi.fn().mockRejectedValue(new Error('502 upstream')) });

    await expect(answerQuestion('Why is flying east worse?', deps)).rejects.toBeInstanceOf(
      AdviceGenerationError,
    );
  });
});
