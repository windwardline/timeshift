import { describe, it, expect, beforeEach, vi } from 'vitest';

// Live flight-status route (spec §3). Session-gated; validates the flight number
// and date; calls the client and returns the parsed status. Real
// parseFlightStatus runs; session + client are mocked. No key in tests → 503.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  flightStatus: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/flights/client', () => ({ createFlightClient: () => ({ flightStatus: mocks.flightStatus }) }));

import { GET } from './route';

function get(qs = 'flight=BA178&date=2026-07-02') {
  return GET(new Request(`http://localhost/api/flights/status?${qs}`));
}

describe('GET /api/flights/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AVIATIONSTACK_API_KEY = 'test-key';
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
  });

  it('rejects an anonymous request with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(mocks.flightStatus).not.toHaveBeenCalled();
  });

  it('rejects a missing flight or bad date with 400', async () => {
    expect((await get('date=2026-07-02')).status).toBe(400);
    expect((await get('flight=BA178&date=nope')).status).toBe(400);
    expect(mocks.flightStatus).not.toHaveBeenCalled();
  });

  it('degrades to 503 when no API key is set', async () => {
    delete process.env.AVIATIONSTACK_API_KEY;
    const res = await get();
    expect(res.status).toBe(503);
    expect(mocks.flightStatus).not.toHaveBeenCalled();
  });

  it('returns the parsed status for a valid request', async () => {
    mocks.flightStatus.mockResolvedValue({ data: [{ flight_status: 'active', departure: { delay: 35 } }] });
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: { state: 'delayed', delayMinutes: 35 } });
    expect(mocks.flightStatus).toHaveBeenCalledWith({ flight: 'BA178', date: '2026-07-02' });
  });

  it('maps an upstream failure to 502', async () => {
    mocks.flightStatus.mockRejectedValue(new Error('boom'));
    const res = await get();
    expect(res.status).toBe(502);
  });
});
