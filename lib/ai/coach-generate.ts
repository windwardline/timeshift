import type { LlmClient } from './advice';
import { extractiveResponse } from './extractive';

// Chooses the coach's generation strategy and isolates the demo-critical
// degradation (CLAUDE.md §13):
//   - no key            → compose the grounded extractive answer (no network).
//   - key, call ok      → return the live model response.
//   - key, call fails   → fall back to the grounded extractive answer rather
//                         than erroring, so a provider hiccup mid-demo still
//                         yields a real, sourced answer.
// `createClient` is injected so this stays unit-testable without the network.
export interface CoachGenerateDeps {
  apiKey?: string;
  createClient: (apiKey: string) => LlmClient;
}

export function makeCoachGenerate(deps: CoachGenerateDeps): (prompt: string) => Promise<string> {
  const { apiKey, createClient } = deps;
  if (!apiKey) {
    return async (prompt) => JSON.stringify(extractiveResponse(prompt));
  }

  const client = createClient(apiKey);
  return async (prompt) => {
    try {
      return await client.complete(prompt);
    } catch (error) {
      console.warn('[coach] live generation failed; serving grounded extractive answer:', String(error));
      return JSON.stringify(extractiveResponse(prompt));
    }
  };
}
