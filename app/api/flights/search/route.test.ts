import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Flight search route (spec §3/§6): session-gated; validates params; serves the
// cache when fresh, else calls the client, parses + sorts, and caches. Real
// validate/parse/sort run; session, client, and cache are mocked. No API key is
// set in tests — the route must degrade to 503 without one.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  searchFlights: vi.fn(),
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/flights/client', () => ({ createFlightClient: () => ({ searchFlights: mocks.searchFlights }) }));
vi.mock('@/lib/flights/cache', () => ({ readCache: mocks.readCache, writeCache: mocks.writeCache }));

import { GET } from './route';

const RAW = {
  data: [
    {
      departure: { timezone: 'Europe/London', iata: 'LHR', scheduled: '2026-07-02T11:40:00+01:00' },
      arrival: { timezone: 'Asia/Singapore', iata: 'SIN', scheduled: '2026-07-03T07:30:00+08:00' },
      airline: { name: 'British Airways', iata: 'BA' },
      flight: { number: '11', iata: 'BA11' },
    },
    {
      departure: { timezone: 'America/New_York', iata: 'JFK', scheduled: '2026-07-01T21:30:00-04:00' },
      arrival: { timezone: 'Europe/London', iata: 'LHR', scheduled: '2026-07-02T09:20:00+01:00' },
      airline: { name: 'British Airways', iata: 'BA' },
      flight: { number: '178', iata: 'BA178' },
    },
  ],
};

// The fixtures above and the assertions below are pinned to 2026-07-02, and
// validateSearchParams rejects a date in the past. The route calls it without
// injecting `now`, so the suite reads the real clock and would start failing
// once that date passed. Freeze the clock the day before instead of chasing the
// dates: only Date is faked, so timers and promises still behave normally.
const NOW = new Date('2026-07-01T00:00:00Z');

function get(qs = 'from=JFK&to=LHR&date=2026-07-02') {
  return GET(new Request(`http://localhost/api/flights/search?${qs}`));
}

describe('GET /api/flights/search', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    process.env.AVIATIONSTACK_API_KEY = 'test-key';
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1' });
    mocks.readCache.mockResolvedValue(null);
    mocks.writeCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects an anonymous request with 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(mocks.searchFlights).not.toHaveBeenCalled();
  });

  it('rejects invalid params with 400 and never calls the client', async () => {
    const res = await get('from=jfk&to=LHR&date=2026-07-02');
    expect(res.status).toBe(400);
    expect(mocks.searchFlights).not.toHaveBeenCalled();
  });

  it('degrades to 503 when no API key is set', async () => {
    delete process.env.AVIATIONSTACK_API_KEY;
    const res = await get();
    expect(res.status).toBe(503);
    expect(mocks.searchFlights).not.toHaveBeenCalled();
  });

  it('serves the cache when fresh, without calling the client', async () => {
    mocks.readCache.mockResolvedValue([{ flightNumber: 'CACHED 1' }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).flights).toEqual([{ flightNumber: 'CACHED 1' }]);
    expect(mocks.searchFlights).not.toHaveBeenCalled();
  });

  it('on a cache miss, fetches + parses + sorts + caches', async () => {
    mocks.searchFlights.mockResolvedValue(RAW);
    const res = await get();
    expect(res.status).toBe(200);
    const flights = (await res.json()).flights;
    expect(flights).toHaveLength(2);
    expect(flights[0].flightNumber).toBe('BA 178'); // earliest departure first
    expect(mocks.searchFlights).toHaveBeenCalledWith({ from: 'JFK', to: 'LHR', date: '2026-07-02' });
    expect(mocks.writeCache).toHaveBeenCalledWith('JFK:LHR:2026-07-02', flights);
  });

  it('maps an upstream failure to 502', async () => {
    mocks.searchFlights.mockRejectedValue(new Error('boom'));
    const res = await get();
    expect(res.status).toBe(502);
  });
});
