import { describe, it, expect, beforeEach, vi } from 'vitest';

// TTL cache for flight searches (spec §5): serves a stored payload while it's
// within 6h, otherwise misses so the route re-fetches. `now` is injected for
// determinism. Prisma is the mocked boundary.
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({
  prisma: { flightQueryCache: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { readCache, writeCache } from './cache';
import type { FlightOption } from './types';

const NOW = new Date('2026-07-01T12:00:00Z');
const payload = [{ flightNumber: 'BA 178' }] as unknown as FlightOption[];

describe('readCache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when there is no cached row', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await readCache('JFK:LHR:2026-07-02', NOW)).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { queryKey: 'JFK:LHR:2026-07-02' } });
  });

  it('returns the payload when the row is within the 6h TTL', async () => {
    mocks.findUnique.mockResolvedValue({ payload, fetchedAt: new Date('2026-07-01T11:00:00Z') }); // 1h old
    expect(await readCache('JFK:LHR:2026-07-02', NOW)).toEqual(payload);
  });

  it('returns null when the row is older than the TTL', async () => {
    mocks.findUnique.mockResolvedValue({ payload, fetchedAt: new Date('2026-07-01T05:00:00Z') }); // 7h old
    expect(await readCache('JFK:LHR:2026-07-02', NOW)).toBeNull();
  });
});

describe('writeCache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts the payload by query key', async () => {
    mocks.upsert.mockResolvedValue({});
    await writeCache('JFK:LHR:2026-07-02', payload);
    const arg = mocks.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ queryKey: 'JFK:LHR:2026-07-02' });
    expect(arg.create.queryKey).toBe('JFK:LHR:2026-07-02');
    expect(arg.create.payload).toBe(payload);
    expect(arg.update.payload).toBe(payload);
  });
});
