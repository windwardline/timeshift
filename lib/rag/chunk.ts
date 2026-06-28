import type { Chunk } from './types';

// Split a KB markdown doc into one chunk per `##` section (US-R). PURE string
// parsing — no I/O. The preamble before the first `##` (minus the `# Title`
// line) becomes an `intro` chunk only when it carries real prose. Ids are
// `${docId}#${index}` in document order so precomputed embeddings stay stable.
export function chunkMarkdown(raw: string, docId: string): Chunk[] {
  const lines = raw.split('\n');
  const chunks: Chunk[] = [];

  let heading: string | null = null; // null until the first `##`; preamble is `intro`
  let body: string[] = [];

  const flush = (h: string | null, lines: string[]) => {
    const text = lines.join('\n').trim();
    if (h === null) {
      // Preamble: drop the leading `# Title` line, keep any remaining prose.
      const prose = lines
        .filter((l) => !l.startsWith('# '))
        .join('\n')
        .trim();
      if (prose) chunks.push(makeChunk(docId, chunks.length, 'intro', prose));
      return;
    }
    chunks.push(makeChunk(docId, chunks.length, h, text));
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush(heading, body);
      heading = line.slice(3).trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  flush(heading, body);

  return chunks;
}

function makeChunk(docId: string, index: number, heading: string, text: string): Chunk {
  return { id: `${docId}#${index}`, docId, heading, text };
}
