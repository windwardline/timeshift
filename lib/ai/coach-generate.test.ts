import { describe, it, expect, vi } from 'vitest';
import { buildGroundedPrompt } from './prompt';
import { makeCoachGenerate } from './coach-generate';
import type { LlmClient } from './advice';
import type { ScoredChunk } from '@/lib/rag/types';

// makeCoachGenerate picks the coach's generation strategy and — critically for a
// live demo — degrades a failed provider call to the grounded extractive answer
// instead of erroring out (CLAUDE.md §13). Deterministic, so held to 100%.

const PROMPT = buildGroundedPrompt('When should I take melatonin?', [
  { docId: 'a', heading: 'Melatonin timing', text: 'Take melatonin 30 minutes before bed.', score: 1 } as ScoredChunk,
]);

describe('makeCoachGenerate', () => {
  it('serves the extractive answer (no client) when no key is configured', async () => {
    const createClient = vi.fn();
    const generate = makeCoachGenerate({ createClient });

    const raw = await generate(PROMPT);

    expect(createClient).not.toHaveBeenCalled();
    expect(JSON.parse(raw).answer).toContain('Take melatonin 30 minutes before bed.');
  });

  it('returns the live model response when the keyed client succeeds', async () => {
    const client: LlmClient = { complete: vi.fn().mockResolvedValue('{"answer":"live","followUp":"x"}') };
    const generate = makeCoachGenerate({ apiKey: 'k', createClient: () => client });

    expect(await generate(PROMPT)).toBe('{"answer":"live","followUp":"x"}');
  });

  it('falls back to the grounded extractive answer when the live call fails', async () => {
    const client: LlmClient = { complete: vi.fn().mockRejectedValue(new Error('rate limited')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const generate = makeCoachGenerate({ apiKey: 'k', createClient: () => client });

    const raw = await generate(PROMPT);

    expect(JSON.parse(raw).answer).toContain('Take melatonin 30 minutes before bed.');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
