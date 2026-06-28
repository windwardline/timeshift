// Build-time script (US-R, Task 9): embed every KB chunk with Google embeddings
// and write the vectors to docs/kb/kb-embeddings.json, which is committed so the
// app + test suite run deterministically and keyless. This is the ONLY step that
// spends a real key on the KB; run it once whenever the KB text changes:
//
//   npm run embed:kb        # reads GEMINI_API_KEY from .env.local
//
// Keyless, it exits without overwriting so the app stays on the lexical path.
//
// Note: imports use explicit .ts extensions and the KB load is inlined (rather
// than reusing lib/rag/corpus.ts) so this runs under raw Node ESM, which — unlike
// Vitest/Next — requires extensions on relative imports.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { chunkMarkdown } from '../lib/rag/chunk.ts';
import { EMBED_MODEL, EMBED_DIM } from '../lib/rag/embed.ts';
import type { KbVector } from '../lib/rag/types.ts';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      'No GEMINI_API_KEY set — leaving docs/kb/kb-embeddings.json untouched ' +
        '(the coach runs on the lexical fallback without it).',
    );
    process.exit(1);
  }

  const kbDir = join(process.cwd(), 'docs', 'kb');
  const chunks = readdirSync(kbDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .flatMap((file) => chunkMarkdown(readFileSync(join(kbDir, file), 'utf8'), file));

  const ai = new GoogleGenAI({ apiKey });

  // One batched embedContent call over all chunk texts (contents accepts an array).
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: chunks.map((c) => c.text),
    config: { outputDimensionality: EMBED_DIM },
  });

  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== chunks.length) {
    throw new Error(`Expected ${chunks.length} embeddings, got ${embeddings.length}`);
  }

  const vectors: KbVector[] = chunks.map((c, i) => {
    const vector = embeddings[i].values;
    if (!vector || vector.length === 0) throw new Error(`Empty embedding for chunk ${c.id}`);
    return { id: c.id, vector };
  });

  const out = join(kbDir, 'kb-embeddings.json');
  writeFileSync(out, JSON.stringify(vectors) + '\n');
  console.info(`Wrote ${vectors.length} KB vectors (${EMBED_MODEL}, ${EMBED_DIM}d) to ${out}`);
}

main().catch((error) => {
  console.error('embed-kb failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
