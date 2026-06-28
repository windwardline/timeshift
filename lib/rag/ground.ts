import type { Decision, ScoredChunk } from './types';

// The grounding gate (US-R / AC-R2, AC-R3): retrieval is only answerable when its
// best chunk clears the threshold. When it does, we keep just the chunks at/above
// the threshold so the model — and the Sources list — see exactly the supporting
// evidence and nothing weaker. Below threshold we refuse, and the orchestrator
// makes no generation call. PURE.
export function decideAnswerable(scored: ScoredChunk[], threshold: number): Decision {
  const topScore = scored.reduce((max, c) => Math.max(max, c.score), -Infinity);
  if (scored.length === 0 || topScore < threshold) {
    return { answerable: false };
  }
  const chunks = scored.filter((c) => c.score >= threshold);
  return { answerable: true, chunks };
}
