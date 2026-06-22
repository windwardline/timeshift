import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-F1 + US-B4: the advice route enforces access (showcase trip is public;
// private trips are owner-only — a non-owner gets a bare 404), then runs the
// real facts + generateAdvice with only the network client mocked.
const mocks = vi.hoisted(() => ({
  getTripWithOwner: vi.fn(),
  getCurrentUser: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('@/lib/db/trips', () => ({ getTripWithOwner: mocks.getTripWithOwner }));
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/ai/client', () => ({ createOpenAiClient: () => ({ complete: mocks.complete }) }));

import { POST } from './route';

const plan = {
  summary: 'Shift east before you fly.',
  preFlight: ['Sleep earlier for two nights.'],
  inFlight: ['Sleep during the Tokyo-night window.'],
  postArrival: ['Get morning sunlight in Tokyo.'],
};

function tripOwnedBy(userId: string, email: string) {
  return {
    id: 'trip1',
    userId,
    destination: 'Asia/Tokyo',
    user: { email },
    segments: [
      {
        departureTime: new Date('2025-06-02T10:00:00Z'),
        arrivalTime: new Date('2025-06-03T01:00:00Z'),
        departureTz: 'America/New_York',
        arrivalTz: 'Asia/Tokyo',
      },
    ],
  };
}

function post() {
  return POST(new Request('http://localhost/api/trips/trip1/advice', { method: 'POST' }), {
    params: Promise.resolve({ id: 'trip1' }),
  });
}

describe('POST /api/trips/[id]/advice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mocks.complete.mockResolvedValue(JSON.stringify(plan));
  });

  it('returns the plan for the trip owner', async () => {
    mocks.getTripWithOwner.mockResolvedValue(tripOwnedBy('u1', 'owner@example.com'));
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(plan);
    expect(mocks.complete.mock.calls[0][0]).toContain('Asia/Tokyo');
  });

  it('serves the public showcase trip even without a session', async () => {
    mocks.getTripWithOwner.mockResolvedValue(tripOwnedBy('demo', 'demo@timeshift.app'));
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await post();

    expect(res.status).toBe(200);
  });

  it('hides another user’s private trip with a 404 (US-B4)', async () => {
    mocks.getTripWithOwner.mockResolvedValue(tripOwnedBy('u1', 'owner@example.com'));
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' }); // a different user

    const res = await post();

    expect(res.status).toBe(404);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('degrades to 503 when no API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    mocks.getTripWithOwner.mockResolvedValue(tripOwnedBy('u1', 'owner@example.com'));
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });

    const res = await post();

    expect(res.status).toBe(503);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
