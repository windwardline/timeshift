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
import { stripFrontmatter } from '../lib/rag/frontmatter.ts';
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
    .flatMap((file) => chunkMarkdown(stripFrontmatter(readFileSync(join(kbDir, file), 'utf8')).body, file));

  const ai = new GoogleGenAI({ apiKey });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // The embeddings API caps a batch at 100 inputs AND the free tier allows ~100
  // requests/minute, so we send modest batches and pace between them, retrying on
  // a 429 rate-limit. This is a one-off build step, so the wait is acceptable.
  const BATCH = 80;
  const vectors: KbVector[] = [];
  const batches = Math.ceil(chunks.length / BATCH);
  for (let b = 0; b < batches; b++) {
    const batch = chunks.slice(b * BATCH, b * BATCH + BATCH);

    let embeddings;
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await ai.models.embedContent({
          model: EMBED_MODEL,
          contents: batch.map((c) => c.text),
          config: { outputDimensionality: EMBED_DIM },
        });
        embeddings = response.embeddings ?? [];
        break;
      } catch (err) {
        const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
        if (!is429 || attempt > 5) throw err;
        console.info(`Rate limited on batch ${b + 1}/${batches}; waiting 60s…`);
        await sleep(60_000);
      }
    }

    if (embeddings.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${embeddings.length}`);
    }
    batch.forEach((c, i) => {
      const vector = embeddings[i].values;
      if (!vector || vector.length === 0) throw new Error(`Empty embedding for chunk ${c.id}`);
      vectors.push({ id: c.id, vector });
    });
    console.info(`Embedded batch ${b + 1}/${batches} (${vectors.length}/${chunks.length} chunks)`);

    if (b < batches - 1) await sleep(62_000); // stay under ~100 requests/minute
  }

  const out = join(kbDir, 'kb-embeddings.json');
  writeFileSync(out, JSON.stringify(vectors) + '\n');
  console.info(`Wrote ${vectors.length} KB vectors (${EMBED_MODEL}, ${EMBED_DIM}d) to ${out}`);
}

main().catch((error) => {
  console.error('embed-kb failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
