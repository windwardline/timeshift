import type { TripFacts } from './facts';
import { buildAdvicePrompt } from './prompt';
import { parseAdviceResponse, type AdvicePlan } from './parse';

// The network seam. `generateAdvice` depends only on this interface, so tests
// inject a mock and never touch the real provider (CLAUDE.md §13). The single
// real implementation lives in client.ts (the only network module).
export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

// Typed failure for a failed provider call (AC-F1.5), so a network/provider
// error surfaces as a known type rather than crashing the caller with a raw
// error of unknown shape.
export class AdviceGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AdviceGenerationError';
  }
}

// AI-4/AI-5 (US-F1 / AC-F1.4, AC-F1.5): orchestrate facts -> prompt -> client ->
// parsed plan. Pure orchestration; the client is injected.
export async function generateAdvice(
  facts: TripFacts,
  client: LlmClient,
): Promise<AdvicePlan> {
  const prompt = buildAdvicePrompt(facts);
  let raw: string;
  try {
    raw = await client.complete(prompt);
  } catch (cause) {
    throw new AdviceGenerationError('The advice provider call failed', { cause });
  }
  return parseAdviceResponse(raw);
}
