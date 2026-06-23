import { describe, it, expect, beforeEach, vi } from 'vitest';

// P7.5 / US-D1: return the engine's assembled timeline for the owner. Ownership
// is enforced by the scoped load (a non-owner gets a bare 404, US-B4). The real
// assembleTimeline runs; the DB and session are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripWithSegments: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/db/trips', () => ({ getTripWithSegments: mocks.getTripWithSegments }));

import { GET } from './route';

// Two-leg trip with a layover (LHR ground time) so the timeline has segments + a
// layover block to assert on.
const ownedTrip = {
  id: 'trip1',
  userId: 'u1',
  destination: 'Asia/Singapore',
  segments: [
    {
      sequence: 0,
      departureAirport: 'JFK',
      arrivalAirport: 'LHR',
      departureTime: new Date('2025-07-02T01:30:00Z'),
      arrivalTime: new Date('2025-07-02T08:20:00Z'),
      departureTz: 'America/New_York',
      arrivalTz: 'Europe/London',
    },
    {
      sequence: 1,
      departureAirport: 'LHR',
      arrivalAirport: 'SIN',
      departureTime: new Date('2025-07-02T10:40:00Z'),
      arrivalTime: new Date('2025-07-02T23:30:00Z'),
      departureTz: 'Europe/London',
      arrivalTz: 'Asia/Singapore',
    },
  ],
};

function get(id = 'trip1') {
  return GET(new Request(`http://localhost/api/trips/${id}/timeline`), {
    params: Promise.resolve({ id }),
  });
}

describe('GET /api/trips/[id]/timeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the assembled timeline for the owner', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.getTripWithSegments.mockResolvedValue(ownedTrip);

    const res = await get();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mocks.getTripWithSegments).toHaveBeenCalledWith('trip1', 'u1');
    // Axis spans the whole journey; items include both flights and the layover.
    expect(new Date(body.timeline.start).toISOString()).toBe('2025-07-02T01:30:00.000Z');
    expect(new Date(body.timeline.end).toISOString()).toBe('2025-07-02T23:30:00.000Z');
    const kinds = body.timeline.items.map((i: { kind: string }) => i.kind);
    expect(kinds.filter((k: string) => k === 'flight')).toHaveLength(2);
    expect(kinds).toContain('layover');
  });

  it('rejects an anonymous request with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
  });

  it('returns 404 when the trip is not the caller’s (US-B4)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' });
    mocks.getTripWithSegments.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(404);
  });
});
