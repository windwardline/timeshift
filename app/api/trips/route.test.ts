import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-B1/B2/C1 route wiring: POST creates a trip owned by the signed-in user
// (anonymous is rejected); GET lists only that user's trips. Real
// normalizeTripInput runs; the DB and session are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createTrip: vi.fn(),
  listTrips: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/db/trips', () => ({ createTrip: mocks.createTrip, listTrips: mocks.listTrips }));

import { POST, GET } from './route';

const validLeg = {
  departureAirport: 'JFK',
  arrivalAirport: 'LHR',
  departureLocal: '2025-06-01T18:00',
  arrivalLocal: '2025-06-02T06:00',
  departureTz: 'America/New_York',
  arrivalTz: 'Europe/London',
};

function post(body: unknown) {
  return POST(new Request('http://localhost/api/trips', { method: 'POST', body: JSON.stringify(body) }));
}

describe('POST /api/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTrip.mockResolvedValue({ id: 'new-trip' });
  });

  it('creates a trip owned by the signed-in user', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });

    const res = await post({ name: 'NYC → London', segments: [validLeg] });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'new-trip' });
    const arg = mocks.createTrip.mock.calls[0][0];
    expect(arg.userId).toBe('u1');
    expect(arg.segments[0].departureTime.toISOString()).toBe('2025-06-01T22:00:00.000Z');
  });

  it('rejects an anonymous request with 401 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await post({ name: 'NYC → London', segments: [validLeg] });

    expect(res.status).toBe(401);
    expect(mocks.createTrip).not.toHaveBeenCalled();
  });

  it('rejects an impossible leg with 400', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });

    const res = await post({ name: 'Impossible', segments: [{ ...validLeg, arrivalLocal: '2025-06-01T17:00' }] });

    expect(res.status).toBe(400);
    expect(mocks.createTrip).not.toHaveBeenCalled();
  });
});

describe('GET /api/trips', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the signed-in user’s trips', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.listTrips.mockResolvedValue([{ id: 't1', name: 'Trip', destination: 'Asia/Tokyo' }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ trips: [{ id: 't1', name: 'Trip', destination: 'Asia/Tokyo' }] });
    expect(mocks.listTrips).toHaveBeenCalledWith('u1');
  });

  it('rejects an anonymous list with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
