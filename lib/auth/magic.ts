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
 *  return the email; otherwise return null. Single-use.
 *
 *  The claim is ONE conditional write, scoped the way the ownership writes in
 *  lib/db/trips.ts are: every validity condition sits in the WHERE, so Postgres
 *  holds the row lock while it re-evaluates them, and `count` reports whether
 *  this caller is the one that consumed the token. Reading the row first and
 *  then writing usedAt leaves a window where two concurrent verifies of the
 *  same token both see `usedAt: null` and both mint a session — reachable
 *  whenever a mail scanner prefetches the link while the recipient clicks it. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const record = await prisma.loginToken.findUnique({ where: { token } });
  if (!record) {
    return null;
  }

  // The read above only supplies the address. Validity and single-use are
  // decided here, by the write, so nothing rests on what the read saw.
  const claimed = await prisma.loginToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1 ? record.email : null;
}
