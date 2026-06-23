import { describe, it, expect, beforeEach, vi } from 'vitest';

// P7.4 / US-C1+C2+B4: append a flight leg to an owned trip. Requires a session;
// the leg is UTC-normalized and appended at the next sequence. A non-owner (the
// ownership-scoped load returns null) gets a bare 404. Real normalizeSegmentInput
// runs; the DB and session are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripWithSegments: vi.fn(),
  appendSegment: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/db/trips', () => ({
  getTripWithSegments: mocks.getTripWithSegments,
  appendSegment: mocks.appendSegment,
}));

import { POST } from './route';

const validLeg = {
  departureAirport: 'LHR',
  arrivalAirport: 'SIN',
  departureLocal: '2025-07-02T11:40',
  arrivalLocal: '2025-07-03T07:30',
  departureTz: 'Europe/London',
  arrivalTz: 'Asia/Singapore',
  departureLat: 51.47,
  departureLng: -0.4543,
  arrivalLat: 1.3644,
  arrivalLng: 103.9915,
};

function post(body: unknown, id = 'trip1') {
  return POST(
    new Request(`http://localhost/api/trips/${id}/segments`, { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
}

// A trip the owner already has, with one existing leg (so the next sequence is 1).
const ownedTrip = { id: 'trip1', userId: 'u1', segments: [{ sequence: 0 }] };

describe('POST /api/trips/[id]/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appendSegment.mockResolvedValue({ id: 'seg2' });
  });

  it('appends a normalized leg at the next sequence for the owner', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.getTripWithSegments.mockResolvedValue(ownedTrip);

    const res = await post(validLeg);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'seg2' });
    expect(mocks.getTripWithSegments).toHaveBeenCalledWith('trip1', 'u1');
    const [tripId, leg] = mocks.appendSegment.mock.calls[0];
    expect(tripId).toBe('trip1');
    expect(leg.sequence).toBe(1); // appended after the existing seg
    expect(leg.departureTime.toISOString()).toBe('2025-07-02T10:40:00.000Z'); // 11:40 BST → 10:40Z
    expect(leg.arrivalLat).toBe(1.3644); // coords preserved (US-C4)
  });

  it('rejects an anonymous request with 401 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await post(validLeg);

    expect(res.status).toBe(401);
    expect(mocks.appendSegment).not.toHaveBeenCalled();
  });

  it('returns 404 when the trip is not the caller’s (US-B4) and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' });
    mocks.getTripWithSegments.mockResolvedValue(null); // ownership-scoped load misses

    const res = await post(validLeg);

    expect(res.status).toBe(404);
    expect(mocks.appendSegment).not.toHaveBeenCalled();
  });

  it('rejects an impossible leg with 400 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.getTripWithSegments.mockResolvedValue(ownedTrip);

    const res = await post({ ...validLeg, arrivalLocal: '2025-07-02T11:00' });

    expect(res.status).toBe(400);
    expect(mocks.appendSegment).not.toHaveBeenCalled();
  });
});
