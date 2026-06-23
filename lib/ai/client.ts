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

// Fast, inexpensive default; override with GEMINI_MODEL if your account differs.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

/**
 * Build the real provider-backed LlmClient. The API key is read server-side
 * only (the API route passes it in from process.env) and never reaches the
 * browser. JSON output is requested so parseAdviceResponse receives clean JSON.
 */
export function createGeminiClient(apiKey: string): LlmClient {
  const ai = new GoogleGenAI({ apiKey });

  return {
    async complete(prompt: string): Promise<string> {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      // Redacted server-side request log for demo evidence (no key, no content).
      console.info(
        `[ai] advice request model=${MODEL} ` +
          `tokens=${response.usageMetadata?.totalTokenCount ?? '?'}`,
      );

      return response.text ?? '';
    },
  };
}
