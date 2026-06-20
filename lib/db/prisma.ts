import { PrismaClient } from '@prisma/client';

// Single shared Prisma client. In dev, Next.js hot-reload re-imports modules
// repeatedly; without caching on globalThis each reload would open a new pool
// and exhaust Postgres connections. In production a single instance is used.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
