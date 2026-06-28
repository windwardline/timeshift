/* v8 ignore file */
// Filesystem shell (US-R, CLAUDE.md §4/§13): reads the KB markdown corpus and the
// precomputed kb-embeddings.json from disk. Excluded from coverage because it does
// fs I/O; the pure chunking it delegates to is unit-tested in lib/rag/chunk.ts.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chunkMarkdown } from './chunk';
import type { Chunk, KbVector } from './types';

const KB_DIR = join(process.cwd(), 'docs', 'kb');
const EMBEDDINGS_FILE = join(KB_DIR, 'kb-embeddings.json');

export function loadCorpus(): { chunks: Chunk[]; vectors: KbVector[] } {
  const files = readdirSync(KB_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const chunks = files.flatMap((file) =>
    chunkMarkdown(readFileSync(join(KB_DIR, file), 'utf8'), file),
  );

  // Absent vectors file is an expected state (keyless build) → degrade to the
  // lexical path. A present-but-corrupt file is NOT masked: JSON.parse throws.
  const vectors: KbVector[] = existsSync(EMBEDDINGS_FILE)
    ? (JSON.parse(readFileSync(EMBEDDINGS_FILE, 'utf8')) as KbVector[])
    : [];

  return { chunks, vectors };
}
