import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-B3 + US-B4: rename and delete a trip, ownership-scoped. The repo writes
// with `where: { id, userId }` so a non-owner's write affects 0 rows → the route
// returns 404 and nothing changes. Session + repo are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  renameTrip: vi.fn(),
  deleteTrip: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/db/trips', () => ({ renameTrip: mocks.renameTrip, deleteTrip: mocks.deleteTrip }));

import { PATCH, DELETE } from './route';

function patch(body: unknown, id = 'trip1') {
  return PATCH(new Request(`http://localhost/api/trips/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
}
function del(id = 'trip1') {
  return DELETE(new Request(`http://localhost/api/trips/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  });
}

describe('PATCH /api/trips/[id] (rename)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames the owner’s trip', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.renameTrip.mockResolvedValue({ count: 1 });

    const res = await patch({ name: 'Renamed trip' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'trip1', name: 'Renamed trip' });
    expect(mocks.renameTrip).toHaveBeenCalledWith('trip1', 'u1', 'Renamed trip');
  });

  it('rejects an empty name with 400 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    const res = await patch({ name: '   ' });
    expect(res.status).toBe(400);
    expect(mocks.renameTrip).not.toHaveBeenCalled();
  });

  it('returns 404 when the trip is not the caller’s (0 rows, US-B4)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' });
    mocks.renameTrip.mockResolvedValue({ count: 0 });
    const res = await patch({ name: 'Hijack' });
    expect(res.status).toBe(404);
  });

  it('rejects an anonymous rename with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await patch({ name: 'x' });
    expect(res.status).toBe(401);
    expect(mocks.renameTrip).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/trips/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the owner’s trip', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.deleteTrip.mockResolvedValue({ count: 1 });

    const res = await del();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.deleteTrip).toHaveBeenCalledWith('trip1', 'u1');
  });

  it('returns 404 deleting another user’s trip (0 rows, US-B4)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2' });
    mocks.deleteTrip.mockResolvedValue({ count: 0 });
    const res = await del();
    expect(res.status).toBe(404);
  });

  it('rejects an anonymous delete with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(401);
    expect(mocks.deleteTrip).not.toHaveBeenCalled();
  });
});
