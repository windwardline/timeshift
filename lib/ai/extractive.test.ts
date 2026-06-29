import { describe, it, expect } from 'vitest';
import { buildGroundedPrompt } from './prompt';
import { extractiveResponse } from './extractive';
import type { ScoredChunk } from '@/lib/rag/types';

// extractiveResponse composes a grounded { answer, followUp } from the retrieved
// passages embedded in the prompt's Context block — no model call. It is the
// keyless path AND the live-failure fallback (CLAUDE.md §13), so it is held to
// 100% coverage like the rest of the deterministic AI surface.

function chunk(docId: string, heading: string, text: string): ScoredChunk {
  return { docId, heading, text, score: 1 } as ScoredChunk;
}

describe('extractiveResponse', () => {
  it('quotes the top two passages and points the follow-up at a later real topic', () => {
    const prompt = buildGroundedPrompt('When should I take melatonin?', [
      chunk('a', 'Melatonin timing', 'Take melatonin 30 minutes before target bedtime.'),
      chunk('b', 'Intro', 'Welcome to jetlag basics.'),
      chunk('c', 'Light exposure', 'Seek morning light at the destination.'),
    ]);

    const { answer, followUp } = extractiveResponse(prompt);

    expect(answer).toContain("From TimeShift's jetlag knowledge base:");
    expect(answer).toContain('Take melatonin 30 minutes before target bedtime.');
    expect(answer).toContain('Welcome to jetlag basics.');
    // The follow-up skips the 'Intro' heading and points at the next real topic.
    expect(followUp).toBe('A natural next step: consider “Light exposure.”');
  });

  it('returns empty strings when the prompt carries no usable context', () => {
    const prompt = buildGroundedPrompt('off topic', []);
    expect(extractiveResponse(prompt)).toEqual({ answer: '', followUp: '' });
  });

  it('degrades to empty strings when the text has no Context block at all', () => {
    // Guards the optional-chaining/nullish path on a malformed/absent prompt.
    expect(extractiveResponse('this string has no context block')).toEqual({ answer: '', followUp: '' });
  });

  it('omits the follow-up when there is no later topic to point at', () => {
    const prompt = buildGroundedPrompt('q', [
      chunk('a', 'Melatonin timing', 'Take melatonin 30 minutes before target bedtime.'),
    ]);
    const { answer, followUp } = extractiveResponse(prompt);
    expect(answer).toContain('Take melatonin 30 minutes before target bedtime.');
    expect(followUp).toBe('');
  });
});
