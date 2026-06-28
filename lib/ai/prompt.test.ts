import { describe, it, expect } from 'vitest';
import { buildAdvicePrompt, buildGroundedPrompt } from './prompt';
import type { TripFacts } from './facts';
import type { ScoredChunk } from '@/lib/rag/types';

// AI-1 / AC-F1.1: the prompt must carry the engine's hard facts so the model
// narrates them rather than inventing them. A NY -> Tokyo red-eye: Tokyo is 13h
// ahead (+780 min), with one in-flight sleep window. The built prompt must
// contain the origin and destination zones, the timezone delta, and the
// sleep-window times.
describe('buildAdvicePrompt', () => {
  it('embeds the timezone delta, both zones, and sleep-window times', () => {
    const facts: TripFacts = {
      originZone: 'America/New_York',
      destinationZone: 'Asia/Tokyo',
      offsetDeltaMinutes: 780,
      crossesDateLine: false,
      sleepWindows: [
        {
          startUtc: '2025-06-02T10:00:00Z',
          endUtc: '2025-06-02T14:00:00Z',
          label: '21:00–01:00 Tokyo',
        },
      ],
    };

    const prompt = buildAdvicePrompt(facts);

    expect(prompt).toContain('America/New_York');
    expect(prompt).toContain('Asia/Tokyo');
    expect(prompt).toContain('780');
    expect(prompt).toContain('2025-06-02T10:00:00Z');
  });

  // AC-F1.1 (branch coverage): the prompt adapts to trip shape. A westward
  // Tokyo -> LA hop reads as "behind" origin, an empty sleep plan as "none
  // recommended", and the date-line crossing is flagged — pinning the branches
  // buildAdvicePrompt added for the live prompt.
  it('describes a westward, date-line-crossing trip with no sleep window', () => {
    const westward: TripFacts = {
      originZone: 'Asia/Tokyo',
      destinationZone: 'America/Los_Angeles',
      offsetDeltaMinutes: -1020,
      crossesDateLine: true,
      sleepWindows: [],
    };

    const prompt = buildAdvicePrompt(westward);

    expect(prompt).toContain('behind origin');
    expect(prompt).toContain('none recommended');
    expect(prompt).toContain('International Date Line: yes');
  });
});

// US-R / AC-R1, AC-R2, AC-R3: the grounded prompt must carry the retrieved
// context (so the answer is grounded), label each chunk's source (so citations
// are real), include the explicit grounding instruction (so the model refuses
// when context is missing), and contain the user's question verbatim. PURE.
describe('buildGroundedPrompt', () => {
  const chunks: ScoredChunk[] = [
    {
      id: 'eastward-vs-westward.md#1',
      docId: 'eastward-vs-westward.md',
      heading: 'Why eastward is harder',
      text: 'Flying east forces your clock to move earlier, a phase advance.',
      score: 0.91,
    },
    {
      id: 'light-exposure.md#0',
      docId: 'light-exposure.md',
      heading: 'Light is the master cue',
      text: 'Bright morning light shifts your clock earlier.',
      score: 0.74,
    },
  ];

  it('embeds every chunk text and a labelled source id', () => {
    const prompt = buildGroundedPrompt('Why is flying east worse?', chunks);

    expect(prompt).toContain('Flying east forces your clock to move earlier, a phase advance.');
    expect(prompt).toContain('Bright morning light shifts your clock earlier.');
    expect(prompt).toContain('eastward-vs-westward.md');
    expect(prompt).toContain('light-exposure.md');
  });

  it('includes the grounding instruction to answer only from the context', () => {
    const prompt = buildGroundedPrompt('Why is flying east worse?', chunks);

    expect(prompt.toLowerCase()).toContain('only');
    expect(prompt.toLowerCase()).toContain('context');
  });

  it('includes the user question verbatim', () => {
    const prompt = buildGroundedPrompt('Why is flying east worse?', chunks);

    expect(prompt).toContain('Why is flying east worse?');
  });
});
