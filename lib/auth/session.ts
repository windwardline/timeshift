import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';

// DB-backed sessions (US-A2): an opaque CSPRNG token is stored server-side and
// handed to the browser in an httpOnly cookie, so it is revocable on logout and
// never exposes anything derivable. No hand-rolled crypto — just secure
// randomness + a lookup.
const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function getUserBySession(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}
