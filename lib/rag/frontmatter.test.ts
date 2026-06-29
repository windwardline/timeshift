import { describe, it, expect } from 'vitest';
import { stripFrontmatter, parseDocSource } from './frontmatter';

// US-R: KB docs carry YAML frontmatter naming a verifiable external source. These
// pure helpers split that frontmatter from the body (so it is never chunked) and
// extract the citation. PURE string parsing — no I/O.
describe('stripFrontmatter', () => {
  it('splits leading --- frontmatter from the body and parses key: value lines', () => {
    const raw = [
      '---',
      'source_title: NHS — Jet lag',
      'source_url: https://www.nhs.uk/conditions/jet-lag/',
      '---',
      '# Title',
      'Body text.',
    ].join('\n');

    const { meta, body } = stripFrontmatter(raw);

    expect(meta.source_title).toBe('NHS — Jet lag');
    // A URL has colons in the value — only the first colon separates key from value.
    expect(meta.source_url).toBe('https://www.nhs.uk/conditions/jet-lag/');
    expect(body).toBe('# Title\nBody text.');
  });

  it('returns empty meta and the unchanged body when there is no frontmatter', () => {
    const raw = '# Title\n\n## Section\nText.';

    const { meta, body } = stripFrontmatter(raw);

    expect(meta).toEqual({});
    expect(body).toBe(raw);
  });

  it('treats an unterminated frontmatter fence as plain body', () => {
    const raw = '---\nsource_title: X\nno closing fence here';

    const { meta, body } = stripFrontmatter(raw);

    expect(meta).toEqual({});
    expect(body).toBe(raw);
  });

  it('skips lines with no colon and lines with an empty key', () => {
    const raw = ['---', 'a comment with no colon', ': orphan value', 'source_title: X', '---', 'Body'].join(
      '\n',
    );

    const { meta, body } = stripFrontmatter(raw);

    expect(meta).toEqual({ source_title: 'X' });
    expect(body).toBe('Body');
  });
});

describe('parseDocSource', () => {
  it('returns a SourceRef when both source fields are present', () => {
    const raw = ['---', 'source_title: CDC', 'source_url: https://cdc.gov', '---', 'Body'].join('\n');

    expect(parseDocSource(raw)).toEqual({ title: 'CDC', url: 'https://cdc.gov' });
  });

  it('returns null when the source frontmatter is missing or incomplete', () => {
    expect(parseDocSource('# No frontmatter')).toBeNull();
    expect(parseDocSource('---\nsource_title: only title\n---\nBody')).toBeNull();
  });
});
