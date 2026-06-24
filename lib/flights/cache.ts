import { prisma } from '../db/prisma';
import type { FlightOption } from './types';

// TTL cache for route+date flight searches (spec §5), protecting the free-tier
// quota. Vercel is serverless, so this lives in the DB rather than memory. `now`
// is injected for deterministic tests.
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

export async function readCache(queryKey: string, now: Date = new Date()): Promise<FlightOption[] | null> {
  const row = await prisma.flightQueryCache.findUnique({ where: { queryKey } });
  if (!row) return null;
  if (now.getTime() - row.fetchedAt.getTime() > TTL_MS) return null;
  return row.payload as unknown as FlightOption[];
}

export async function writeCache(queryKey: string, payload: FlightOption[]): Promise<void> {
  const data = payload as unknown as object; // Prisma Json column
  await prisma.flightQueryCache.upsert({
    where: { queryKey },
    create: { queryKey, payload: data },
    update: { payload: data, fetchedAt: new Date() },
  });
}
