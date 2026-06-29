import type { Chunk } from './types';

// Split markdown body into one chunk per `##` section (US-R). PURE string parsing
// — no I/O. The caller is responsible for stripping any YAML frontmatter first
// (see stripFrontmatter); this keeps the chunker single-purpose and loadable from
// the build script under raw Node. The preamble before the first `##` (minus the
// `# Title` line) becomes an `intro` chunk only when it carries real prose. Ids
// are `${docId}#${index}` in document order so precomputed embeddings stay stable.
export function chunkMarkdown(body: string, docId: string): Chunk[] {
  const lines = body.split('\n');
  const chunks: Chunk[] = [];

  let heading: string | null = null; // null until the first `##`; preamble is `intro`
  let section: string[] = [];

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
      flush(heading, section);
      heading = line.slice(3).trim();
      section = [];
    } else {
      section.push(line);
    }
  }
  flush(heading, section);

  return chunks;
}

function makeChunk(docId: string, index: number, heading: string, text: string): Chunk {
  return { id: `${docId}#${index}`, docId, heading, text };
}
