import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from './chunk';

// US-R retrieval depends on splitting each KB doc into one retrievable idea per
// `##` section. chunkMarkdown is PURE string parsing — fed an inline fixture, no
// file read — so it stays a unit and the rule is pinned by assertion.
describe('chunkMarkdown', () => {
  it('splits two `##` sections into two chunks with the right heading and text', () => {
    const raw = ['## First', 'Alpha text.', '', '## Second', 'Beta text.'].join('\n');

    const chunks = chunkMarkdown(raw, 'doc.md');

    expect(chunks).toEqual([
      { id: 'doc.md#0', docId: 'doc.md', heading: 'First', text: 'Alpha text.' },
      { id: 'doc.md#1', docId: 'doc.md', heading: 'Second', text: 'Beta text.' },
    ]);
  });

  it('captures preamble prose after the `# Title` as an `intro` chunk', () => {
    const raw = ['# Title', '', 'Intro prose here.', '', '## First', 'Alpha.'].join('\n');

    const chunks = chunkMarkdown(raw, 'doc.md');

    expect(chunks[0]).toEqual({
      id: 'doc.md#0',
      docId: 'doc.md',
      heading: 'intro',
      text: 'Intro prose here.',
    });
    expect(chunks[1]).toEqual({
      id: 'doc.md#1',
      docId: 'doc.md',
      heading: 'First',
      text: 'Alpha.',
    });
  });

  it('emits no intro chunk when the title has no prose before the first section', () => {
    const raw = ['# Title', '', '## First', 'Alpha.'].join('\n');

    const chunks = chunkMarkdown(raw, 'doc.md');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe('First');
  });

  it('assigns deterministic, unique ids in document order', () => {
    const raw = ['## A', 'a', '## B', 'b', '## C', 'c'].join('\n');

    const ids = chunkMarkdown(raw, 'doc.md').map((c) => c.id);

    expect(ids).toEqual(['doc.md#0', 'doc.md#1', 'doc.md#2']);
    expect(new Set(ids).size).toBe(3);
  });

  it('returns [] for empty or whitespace-only input', () => {
    expect(chunkMarkdown('', 'doc.md')).toEqual([]);
    expect(chunkMarkdown('   \n\n  ', 'doc.md')).toEqual([]);
  });
});
