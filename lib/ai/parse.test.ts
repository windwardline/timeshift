import { describe, it, expect } from 'vitest';
import {
  parseAdviceResponse,
  parseGroundedResponse,
  AdviceParseError,
} from './parse';

// AI-2 / AC-F1.2: a well-formed structured model response (JSON) parses into a
// fully populated AdvicePlan with every required field present.
describe('parseAdviceResponse', () => {
  it('parses a well-formed JSON response into a complete AdvicePlan', () => {
    const raw = JSON.stringify({
      summary: 'Shift your clock east before you fly.',
      preFlight: ['Sleep an hour earlier for two nights.'],
      inFlight: ['Sleep during the Tokyo-night window.'],
      postArrival: ['Get morning sunlight in Tokyo.'],
    });

    const plan = parseAdviceResponse(raw);

    expect(plan).toEqual({
      summary: 'Shift your clock east before you fly.',
      preFlight: ['Sleep an hour earlier for two nights.'],
      inFlight: ['Sleep during the Tokyo-night window.'],
      postArrival: ['Get morning sunlight in Tokyo.'],
    });
  });
});

// AI-3 / AC-F1.3: a malformed response must fail safely with a typed
// AdviceParseError — never a half-populated plan, never a raw SyntaxError or
// ZodError leaking out. Two failure modes: not JSON at all, and JSON that is
// missing required fields.
describe('parseAdviceResponse (malformed)', () => {
  it('throws a typed AdviceParseError on non-JSON input', () => {
    expect(() => parseAdviceResponse('not json at all')).toThrow(AdviceParseError);
  });

  it('throws a typed AdviceParseError when required fields are missing', () => {
    const incomplete = JSON.stringify({ summary: 'only a summary' });
    expect(() => parseAdviceResponse(incomplete)).toThrow(AdviceParseError);
  });
});

// US-R / AC-R1: the grounded coach response carries a single `answer` string.
// It mirrors parseAdviceResponse's contract — a clean parse on well-formed JSON,
// a typed AdviceParseError on malformed input (covered per CLAUDE.md §13).
describe('parseGroundedResponse', () => {
  it('parses a well-formed response into a trimmed answer', () => {
    const raw = JSON.stringify({ answer: '  Flying east is harder.  ' });

    expect(parseGroundedResponse(raw)).toEqual({ answer: 'Flying east is harder.' });
  });

  it('throws a typed AdviceParseError on non-JSON input', () => {
    expect(() => parseGroundedResponse('not json at all')).toThrow(AdviceParseError);
  });

  it('throws a typed AdviceParseError when the answer field is missing', () => {
    const incomplete = JSON.stringify({ notAnswer: 'oops' });
    expect(() => parseGroundedResponse(incomplete)).toThrow(AdviceParseError);
  });
});
