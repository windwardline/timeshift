import { describe, it, expect, beforeEach, vi } from 'vitest';

// Magic-link tokens (US-A2) must be single-use and consumed ATOMICALLY. A
// read-then-write consume (findUnique, check usedAt, then update) leaves a
// window between the check and the write: two verifies of the same token both
// read `usedAt: null` and both mint a session. That window is reachable in
// normal use — a mail scanner prefetching the link while the recipient clicks
// it is two concurrent GETs of /api/auth/verify with one token.
//
// Prisma is the mocked boundary, as in lib/flights/cache.test.ts. The fake
// below models what Postgres actually guarantees, which is the whole point of
// the test:
//   - `findUnique` is a read. It yields before returning, so a caller that
//     reads and then writes is interleavable — the real race window.
//   - `updateMany` is ONE conditional statement. Postgres takes a row lock,
//     re-evaluates the WHERE against the committed row, and reports how many
//     rows matched; the check and the write cannot be split. So the fake
//     evaluates its filter and mutates without yielding in between, and
//     returns `{ count }`.
// A fake that made `updateMany` interleavable would be modelling a database
// Postgres isn't, and would let a racy implementation pass.

type Row = { token: string; email: string; expiresAt: Date; usedAt: Date | null };

let rows: Row[] = [];

/** Yield to the microtask queue — every DB call is a round trip. */
const roundTrip = () => Promise.resolve();

function matches(row: Row, where: Record<string, unknown>): boolean {
  if ('token' in where && row.token !== where.token) return false;
  if ('usedAt' in where && where.usedAt === null && row.usedAt !== null) return false;
  if ('expiresAt' in where) {
    const gt = (where.expiresAt as { gt: Date }).gt;
    if (!(row.expiresAt > gt)) return false;
  }
  return true;
}

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    loginToken: {
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
  },
}));

import { createLoginToken, consumeLoginToken } from './magic';

const HOUR = 60 * 60 * 1000;

function seed(row: Partial<Row> & { token: string }) {
  rows.push({ email: 'traveler@example.com', expiresAt: new Date(Date.now() + HOUR), usedAt: null, ...row });
}

beforeEach(() => {
  rows = [];
  vi.clearAllMocks();

  mocks.create.mockImplementation(async ({ data }: { data: Row }) => {
    await roundTrip();
    rows.push({ ...data, usedAt: data.usedAt ?? null });
    return data;
  });

  // A read. Returns a snapshot: the caller holds a copy, not the live row.
  mocks.findUnique.mockImplementation(async ({ where }: { where: { token: string } }) => {
    await roundTrip();
    const row = rows.find((r) => r.token === where.token);
    return row ? { ...row } : null;
  });

  // An unconditional write.
  mocks.update.mockImplementation(
    async ({ where, data }: { where: { token: string }; data: Partial<Row> }) => {
      await roundTrip();
      const row = rows.find((r) => r.token === where.token);
      if (row) Object.assign(row, data);
      return row;
    },
  );

  // One conditional statement: filter and write are indivisible.
  mocks.updateMany.mockImplementation(
    async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
      await roundTrip();
      const matched = rows.filter((r) => matches(r, where));
      matched.forEach((r) => Object.assign(r, data));
      return { count: matched.length };
    },
  );
});

describe('createLoginToken', () => {
  it('stores an opaque token expiring in exactly 15 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));

    const token = await createLoginToken('traveler@example.com');

    expect(token).toMatch(/^[0-9a-f]{64}$/); // 32 CSPRNG bytes, hex
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('traveler@example.com');
    expect(rows[0].expiresAt.toISOString()).toBe('2026-08-02T12:15:00.000Z');

    vi.useRealTimers();
  });
});

describe('consumeLoginToken', () => {
  it('returns the email for a valid unused token', async () => {
    seed({ token: 'valid' });
    expect(await consumeLoginToken('valid')).toBe('traveler@example.com');
  });

  it('marks the token used so a second, later verify is refused', async () => {
    seed({ token: 'once' });

    expect(await consumeLoginToken('once')).toBe('traveler@example.com');
    expect(await consumeLoginToken('once')).toBeNull();
    expect(rows[0].usedAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown token', async () => {
    expect(await consumeLoginToken('nope')).toBeNull();
  });

  it('returns null for an expired token, and leaves it unconsumed', async () => {
    seed({ token: 'stale', expiresAt: new Date(Date.now() - HOUR) });

    expect(await consumeLoginToken('stale')).toBeNull();
    expect(rows[0].usedAt).toBeNull();
  });

  it('returns null for a token already marked used', async () => {
    seed({ token: 'spent', usedAt: new Date(Date.now() - 60_000) });
    expect(await consumeLoginToken('spent')).toBeNull();
  });

  // The regression this file exists for.
  it('admits exactly one winner when the same token is consumed concurrently', async () => {
    seed({ token: 'contested' });

    const results = await Promise.all([
      consumeLoginToken('contested'),
      consumeLoginToken('contested'),
    ]);

    const won = results.filter((r) => r !== null);
    const refused = results.filter((r) => r === null);

    expect(won).toEqual(['traveler@example.com']);
    expect(refused).toHaveLength(1);
    expect(rows[0].usedAt).toBeInstanceOf(Date);
  });

  it('admits exactly one winner across a wider stampede', async () => {
    seed({ token: 'stampede' });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeLoginToken('stampede')),
    );

    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });
});
