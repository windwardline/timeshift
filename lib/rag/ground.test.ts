import { describe, it, expect } from 'vitest';
import { decideAnswerable } from './ground';
import type { ScoredChunk } from './types';

// AC-R2 / AC-R3: the grounding gate decides whether retrieval is strong enough to
// answer. Below threshold it refuses (no generation downstream); at/above it keeps
// only the supporting chunks so Sources reflect exactly what the model sees. PURE.
const chunk = (id: string, score: number): ScoredChunk => ({
  id,
  docId: `${id}.md`,
  heading: 'h',
  text: 't',
  score,
});

describe('decideAnswerable', () => {
  it('is answerable when the top score clears the threshold, keeping only chunks at/above it', () => {
    const scored = [chunk('a', 0.8), chunk('b', 0.5), chunk('c', 0.2)];

    const decision = decideAnswerable(scored, 0.5);

    expect(decision.answerable).toBe(true);
    if (decision.answerable) {
      expect(decision.chunks.map((c) => c.id)).toEqual(['a', 'b']);
    }
  });

  it('refuses when the top score is below the threshold', () => {
    const scored = [chunk('a', 0.3), chunk('b', 0.1)];

    expect(decideAnswerable(scored, 0.5)).toEqual({ answerable: false });
  });

  it('refuses on empty input', () => {
    expect(decideAnswerable([], 0.5)).toEqual({ answerable: false });
  });

  it('treats a score exactly equal to the threshold as answerable', () => {
    const scored = [chunk('a', 0.5)];

    const decision = decideAnswerable(scored, 0.5);

    expect(decision.answerable).toBe(true);
    if (decision.answerable) {
      expect(decision.chunks.map((c) => c.id)).toEqual(['a']);
    }
  });
});
