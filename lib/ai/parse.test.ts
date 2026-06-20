import { describe, it, expect } from 'vitest';
import { parseAdviceResponse } from './parse';

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
