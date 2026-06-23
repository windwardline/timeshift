/* v8 ignore file */
// The ONLY module in lib/ai that touches the network/SDK (CLAUDE.md §13). It is
// never unit-tested and is explicitly excluded from coverage — model output is
// non-deterministic, so it is exercised live only in the demo with a real key.
// Everything else in lib/ai/ is pure and TDD'd against this interface's mock.
//
// Provider: Google AI Studio (Gemini). (docs/AI_ADVICE.md anticipates this
// swap — only this file and the env var change; the prompt/parse/orchestrate
// units are unchanged.)
import { GoogleGenAI } from '@google/genai';
import type { LlmClient } from './advice';

// Fastest/best-first chain: try each model in order, falling through to the next
// when one errors (e.g. a rate limit / quota exhaustion). Override the whole
// chain with GEMINI_MODELS (comma-separated, fastest first).
const DEFAULT_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
];

const override = process.env.GEMINI_MODELS?.split(',').map((s) => s.trim()).filter(Boolean);
const MODEL_CHAIN = override && override.length ? override : DEFAULT_CHAIN;

/**
 * Build the real provider-backed LlmClient. The API key is read server-side
 * only (the API route passes it in from process.env) and never reaches the
 * browser. JSON output is requested so parseAdviceResponse receives clean JSON.
 */
export function createGeminiClient(apiKey: string): LlmClient {
  const ai = new GoogleGenAI({ apiKey });

  async function generate(model: string, prompt: string): Promise<string> {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    // Redacted server-side request log for demo evidence (no key, no content).
    console.info(
      `[ai] advice request model=${model} ` +
        `tokens=${response.usageMetadata?.totalTokenCount ?? '?'}`,
    );
    return response.text ?? '';
  }

  return {
    async complete(prompt: string): Promise<string> {
      let lastError: unknown;
      for (const model of MODEL_CHAIN) {
        try {
          return await generate(model, prompt);
        } catch (error) {
          lastError = error;
          console.warn(
            `[ai] model ${model} failed; trying next —`,
            error instanceof Error ? error.message : error,
          );
        }
      }
      throw lastError ?? new Error('No Gemini models available');
    },
  };
}
