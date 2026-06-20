import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-F1 route wiring: the advice route loads the ownership-scoped trip, derives
// facts from the engine, and returns the generated plan. We mock the DB and the
// network client only — facts assembly, generateAdvice, and parsing all run for
// real, and no API key is required (the mocked client returns a fixture).
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getTripWithSegments: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: { user: { findFirst: mocks.findFirst } } }));
vi.mock('@/lib/db/trips', () => ({ getTripWithSegments: mocks.getTripWithSegments }));
vi.mock('@/lib/ai/client', () => ({ createAnthropicClient: () => ({ complete: mocks.complete }) }));

import { POST } from './route';

const plan = {
  summary: 'Shift east before you fly.',
  preFlight: ['Sleep earlier for two nights.'],
  inFlight: ['Sleep during the Tokyo-night window.'],
  postArrival: ['Get morning sunlight in Tokyo.'],
};

const trip = {
  id: 'trip1',
  destination: 'Asia/Tokyo',
  segments: [
    {
      departureTime: new Date('2025-06-02T10:00:00Z'),
      arrivalTime: new Date('2025-06-03T01:00:00Z'),
      departureTz: 'America/New_York',
      arrivalTz: 'Asia/Tokyo',
    },
  ],
};

function post(id = 'trip1') {
  return POST(new Request('http://localhost/api/trips/trip1/advice', { method: 'POST' }), {
    params: Promise.resolve({ id }),
  });
}

describe('POST /api/trips/[id]/advice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mocks.findFirst.mockResolvedValue({ id: 'u1', homeTimeZone: 'America/New_York' });
    mocks.getTripWithSegments.mockResolvedValue(trip);
    mocks.complete.mockResolvedValue(JSON.stringify(plan));
  });

  it('returns the generated plan for the owner', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(plan);
    // the client was called with a prompt carrying the engine facts
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(mocks.complete.mock.calls[0][0]).toContain('Asia/Tokyo');
  });

  it('degrades to 503 when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await post();

    expect(res.status).toBe(503);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('returns 404 when the trip is not found for the user', async () => {
    mocks.getTripWithSegments.mockResolvedValue(null);

    const res = await post('missing');

    expect(res.status).toBe(404);
  });
});
