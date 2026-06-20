/* v8 ignore file */
// The ONLY module in lib/ai that touches the network/SDK (CLAUDE.md §13). It is
// never unit-tested and is explicitly excluded from coverage — model output is
// non-deterministic, so it is exercised live only in the demo with a real key.
// Everything else in lib/ai/ is pure and TDD'd against this interface's mock.
import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient } from './advice';

// Default to the latest, most capable Claude model (per the claude-api guidance).
const MODEL = 'claude-opus-4-8';

/**
 * Build the real provider-backed LlmClient. The API key is read server-side
 * only (the API route passes it in from process.env) and never reaches the
 * browser.
 */
export function createAnthropicClient(apiKey: string): LlmClient {
  const anthropic = new Anthropic({ apiKey });

  return {
    async complete(prompt: string): Promise<string> {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      // The prompt asks for a single JSON object; concatenate any text blocks.
      const text = message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

      // Redacted server-side request log for demo evidence (no key, no content).
      console.info(
        `[ai] advice request id=${message.id} model=${MODEL} ` +
          `in=${message.usage.input_tokens} out=${message.usage.output_tokens}`,
      );

      return text;
    },
  };
}
