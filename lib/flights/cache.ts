import { prisma } from '../db/prisma';
import type { FlightOption } from './types';

// TTL cache for route+date flight searches (spec §5), protecting the free-tier
// quota. Vercel is serverless, so this lives in the DB rather than memory. `now`
// is injected for deterministic tests.
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

// The cache is a best-effort optimization, not a correctness requirement. If the
// DB is unreachable or the table isn't migrated yet, a read degrades to a miss
// (search falls through to a live fetch) and a write is skipped — never a 500,
// never a failed search. The failure is logged server-side, so it isn't silent.
export async function readCache(queryKey: string, now: Date = new Date()): Promise<FlightOption[] | null> {
  try {
    const row = await prisma.flightQueryCache.findUnique({ where: { queryKey } });
    if (!row) return null;
    if (now.getTime() - row.fetchedAt.getTime() > TTL_MS) return null;
    return row.payload as unknown as FlightOption[];
  } catch (error) {
    console.warn('[flights] cache read skipped:', String(error));
    return null;
  }
}

export async function writeCache(queryKey: string, payload: FlightOption[]): Promise<void> {
  const data = payload as unknown as object; // Prisma Json column
  try {
    await prisma.flightQueryCache.upsert({
      where: { queryKey },
      create: { queryKey, payload: data },
      update: { payload: data, fetchedAt: new Date() },
    });
  } catch (error) {
    console.warn('[flights] cache write skipped:', String(error));
  }
}
