import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-A3 route wiring: PATCH sets the signed-in user's home time zone. Anonymous
// is rejected; an unrecognized zone is rejected; neither writes. The real
// validateHomeTimeZone runs; the session and DB are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateUserHomeZone: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/db/users', () => ({ updateUserHomeZone: mocks.updateUserHomeZone }));

import { PATCH } from './route';

function patch(body: unknown) {
  return PATCH(new Request('http://localhost/api/profile', { method: 'PATCH', body: JSON.stringify(body) }));
}

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateUserHomeZone.mockResolvedValue(undefined);
  });

  it('updates the signed-in user’s home time zone', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });

    const res = await patch({ homeTimeZone: 'Asia/Singapore' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ homeTimeZone: 'Asia/Singapore' });
    expect(mocks.updateUserHomeZone).toHaveBeenCalledWith('u1', 'Asia/Singapore');
  });

  it('rejects an anonymous request with 401 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await patch({ homeTimeZone: 'Asia/Singapore' });

    expect(res.status).toBe(401);
    expect(mocks.updateUserHomeZone).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized zone with 400 and never writes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });

    const res = await patch({ homeTimeZone: 'Mars/Phobos' });

    expect(res.status).toBe(400);
    expect(mocks.updateUserHomeZone).not.toHaveBeenCalled();
  });
});
