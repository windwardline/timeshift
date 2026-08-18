import { describe, it, expect, beforeEach, vi } from 'vitest';

// The DB half of the fixed-window limiter (#71). Prisma is the mocked boundary,
// as in lib/flights/cache.test.ts. The counter increment is one atomic
// INSERT ... ON CONFLICT, so what is asserted here is the decision the count
// drives, plus the fail-closed behaviour when the statement cannot run at all.
const mocks = vi.hoisted(() => ({ queryRaw: vi.fn(), deleteMany: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({
  prisma: { $queryRaw: mocks.queryRaw, rateLimit: { deleteMany: mocks.deleteMany } },
}));

import { consume } from './limit';

const NOW = new Date('2026-08-18T12:03:00Z');
const opts = { bucket: 'coach', subject: '1.2.3.4', limit: 3, windowMs: 600_000, now: NOW };

describe('consume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // The atomicity this module rests on lives entirely in the shape of one
  // statement, and every other case here asserts what `consume` does with a count
  // it was handed rather than where that count came from. Without this, rewriting
  // the increment as a read-then-write -- `prisma.rateLimit.upsert` with an
  // increment reads as the more idiomatic Prisma call -- passes the suite while
  // reintroducing the burst the limiter exists to stop.
  it('increments with one atomic statement, not a read followed by a write', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);
    await consume(opts);

    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    const sql = mocks.queryRaw.mock.calls[0][0] as { text: string; values: unknown[] };
    const text = sql.text.replace(/\s+/g, ' ').trim();

    expect(text).toMatch(/^INSERT INTO "RateLimit"/i);
    expect(text).toMatch(/ON CONFLICT \("key"\) DO UPDATE/i);
    // The count must come back from the same statement that wrote it -- that is
    // what makes it this caller's position in the window rather than a snapshot.
    expect(text).toMatch(/RETURNING "count"/i);
    expect(text).not.toMatch(/\bSELECT\b/i);
  });

  it('binds the key and expiry as parameters rather than building SQL text', async () => {
    // The key is derived from caller-supplied input (an email, for the
    // magic-link bucket). Interpolating it into the statement would put attacker
    // input in the query rather than beside it.
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);
    await consume(opts);
    const sql = mocks.queryRaw.mock.calls[0][0] as { text: string; values: unknown[] };
    expect(sql.values).toEqual(['coach:6694f83c9f476da31f5df6bcc520034e:2978424', new Date('2026-08-18T12:10:00Z')]);
    expect(sql.text).not.toContain('coach:');
  });

  it('allows a request while the count is within the limit', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);
    expect(await consume(opts)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it('allows the request that exactly reaches the limit', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 3 }]);
    expect((await consume(opts)).allowed).toBe(true);
  });

  it('refuses the first request past the limit, with seconds until the window rolls', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 4 }]);
    expect(await consume(opts)).toEqual({ allowed: false, retryAfter: 420 });
  });

  it('collects expired windows when a new one opens, not on every call', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);
    await consume(opts);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);

    mocks.deleteMany.mockClear();
    mocks.queryRaw.mockResolvedValue([{ count: 2 }]);
    await consume(opts);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('still allows the request when only the collection sweep fails', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);
    mocks.deleteMany.mockRejectedValue(new Error('sweep failed'));
    expect((await consume(opts)).allowed).toBe(true);
  });

  // The limiter guards third-party spend. Degrading to "unlimited" when the DB is
  // unreachable would hand an attacker the bypass, so it fails CLOSED -- and says
  // so in the log, because a silent refusal is impossible to diagnose.
  it('fails closed and logs when the counter cannot be read', async () => {
    mocks.queryRaw.mockRejectedValue(new Error('relation "RateLimit" does not exist'));
    const result = await consume(opts);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
  });

  it('fails closed when the statement returns nothing usable', async () => {
    mocks.queryRaw.mockResolvedValue([]);
    expect((await consume(opts)).allowed).toBe(false);
  });

  it('fails closed when the returned row carries no usable count', async () => {
    mocks.queryRaw.mockResolvedValue([{ count: null }]);
    expect((await consume(opts)).allowed).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('still logs a cause when the rejection is not an Error', async () => {
    // Driver-level rejections are not always Error instances; the log must not
    // degrade to "[object Object]" when diagnosing a refusal.
    mocks.queryRaw.mockRejectedValue('connection terminated');
    expect((await consume(opts)).allowed).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      'coach',
      'connection terminated',
    );
  });

  it('falls back to the current time when no clock is injected', async () => {
    // Production calls omit `now`; only the tests inject one.
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);
    const noClock = { bucket: 'coach', subject: '1.2.3.4', limit: 3, windowMs: 600_000 };
    expect((await consume(noClock)).allowed).toBe(true);
  });
});
