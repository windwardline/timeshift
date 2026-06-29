import type { SourceRef } from './types';

// Pure YAML-frontmatter helpers for KB docs (US-R). A doc may open with a `---`
// fenced block of `key: value` lines naming its verifiable external source; these
// split that block from the body and extract the citation. No I/O.

/** Split leading `---` frontmatter from the body, parsing simple `key: value` lines. */
export function stripFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw };

  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: raw }; // unterminated fence — treat as body

  const block = raw.slice(4, end);
  const meta: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':'); // split on the FIRST colon (URLs contain ':')
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key) meta[key] = value;
  }

  // Body is everything after the closing fence's line, with its leading newline dropped.
  const body = raw.slice(end + '\n---'.length).replace(/^\n/, '');
  return { meta, body };
}

/** Extract the doc's verifiable source citation, or null when it is absent/incomplete. */
export function parseDocSource(raw: string): SourceRef | null {
  const { meta } = stripFrontmatter(raw);
  if (meta.source_title && meta.source_url) {
    return { title: meta.source_title, url: meta.source_url };
  }
  return null;
}
