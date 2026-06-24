import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-C3 + US-B4: edit or delete a flight leg, ownership-scoped through the parent
// trip. The repo writes with a relation filter on the owning user, so a
// non-owner's write affects 0 rows → 404. Real normalizeSegmentInput runs on
// edits; the DB and session are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/db/trips', () => ({ updateSegment: mocks.updateSegment, deleteSegment: mocks.deleteSegment }));

import { PATCH, DELETE } from './route';

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

const params = Promise.resolve({ id: 'trip1', segId: 'seg2' });
function patch(body: unknown) {
  return PATCH(new Request('http://localhost/api/trips/trip1/segments/seg2', { method: 'PATCH', body: JSON.stringify(body) }), { params });
}
function del() {
  return DELETE(new Request('http://localhost/api/trips/trip1/segments/seg2', { method: 'DELETE' }), { params });
}

describe('PATCH /api/trips/[id]/segments/[segId] (edit)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the owner’s leg with UTC-normalized times', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.updateSegment.mockResolvedValue({ count: 1 });

    const res = await patch(validLeg);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'seg2' });
    const [tripId, userId, segId, leg] = mocks.updateSegment.mock.calls[0];
    expect([tripId, userId, segId]).toEqual(['trip1', 'u1', 'seg2']);
    expect(leg.departureTime.toISOString()).toBe('2025-07-02T10:40:00.000Z');
    expect(leg.arrivalLat).toBe(1.3644); // US-C4: coords preserved on edit
  });

  it('rejects an impossible edit with 400 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    const res = await patch({ ...validLeg, arrivalLocal: '2025-07-02T11:00' });
    expect(res.status).toBe(400);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  it('returns 404 editing another user’s leg (0 rows, US-B4)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' });
    mocks.updateSegment.mockResolvedValue({ count: 0 });
    const res = await patch(validLeg);
    expect(res.status).toBe(404);
  });

  it('rejects an anonymous edit with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await patch(validLeg);
    expect(res.status).toBe(401);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/trips/[id]/segments/[segId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the owner’s leg', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.deleteSegment.mockResolvedValue({ count: 1 });

    const res = await del();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.deleteSegment).toHaveBeenCalledWith('trip1', 'u1', 'seg2');
  });

  it('returns 404 deleting another user’s leg (0 rows, US-B4)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' });
    mocks.deleteSegment.mockResolvedValue({ count: 0 });
    const res = await del();
    expect(res.status).toBe(404);
  });

  it('rejects an anonymous delete with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(401);
    expect(mocks.deleteSegment).not.toHaveBeenCalled();
  });
});
