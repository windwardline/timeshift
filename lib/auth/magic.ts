import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';

// Magic-link tokens (US-A2, passwordless): an opaque CSPRNG token is emailed as
// a one-time link, stored server-side with a short expiry, and consumed on
// verify. No hand-rolled crypto — secure randomness + a DB lookup.
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function createLoginToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.loginToken.create({
    data: { token, email, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return token;
}

/** Consume a token: if valid (exists, unused, unexpired), mark it used and
 *  return the email; otherwise return null. Single-use. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const record = await prisma.loginToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  await prisma.loginToken.update({ where: { token }, data: { usedAt: new Date() } });
  return record.email;
}
