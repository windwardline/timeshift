import { describe, it, expect, vi } from 'vitest';
import { generateAdvice, type LlmClient } from './advice';
import type { TripFacts } from './facts';

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

const plan = {
  summary: 'Shift your clock east before you fly.',
  preFlight: ['Sleep an hour earlier for two nights.'],
  inFlight: ['Sleep during the Tokyo-night window.'],
  postArrival: ['Get morning sunlight in Tokyo.'],
};

// AI-4 / AC-F1.4: with a mocked client, generateAdvice must call the client with
// a prompt carrying the engine facts, then return the parsed AdvicePlan.
describe('generateAdvice', () => {
  it('calls the client with a facts-bearing prompt and returns the parsed plan', async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify(plan));
    const client: LlmClient = { complete };

    const result = await generateAdvice(facts, client);

    expect(complete).toHaveBeenCalledOnce();
    const promptArg = complete.mock.calls[0][0] as string;
    expect(promptArg).toContain('Asia/Tokyo');
    expect(promptArg).toContain('780');

    expect(result).toEqual(plan);
  });
});
