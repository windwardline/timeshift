/* v8 ignore file */
// The ONLY module in lib/ai that touches the network/SDK (CLAUDE.md §13). It is
// never unit-tested and is explicitly excluded from coverage — model output is
// non-deterministic, so it is exercised live only in the demo with a real key.
// Everything else in lib/ai/ is pure and TDD'd against this interface's mock.
//
// Provider: OpenAI. (docs/AI_ADVICE.md anticipates this swap — only this file
// and the env var change; the prompt/parse/orchestrate units are unchanged.)
import OpenAI from 'openai';
import type { LlmClient } from './advice';

// Fast, inexpensive default; override with OPENAI_MODEL if your account differs.
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

/**
 * Build the real provider-backed LlmClient. The API key is read server-side
 * only (the API route passes it in from process.env) and never reaches the
 * browser. JSON mode is requested so parseAdviceResponse receives clean JSON.
 */
export function createOpenAiClient(apiKey: string): LlmClient {
  const openai = new OpenAI({ apiKey });

  return {
    async complete(prompt: string): Promise<string> {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      // Redacted server-side request log for demo evidence (no key, no content).
      console.info(
        `[ai] advice request id=${completion.id} model=${MODEL} ` +
          `tokens=${completion.usage?.total_tokens ?? '?'}`,
      );

      return completion.choices[0]?.message?.content ?? '';
    },
  };
}
