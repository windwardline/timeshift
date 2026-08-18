import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { buildKey, retryAfterSeconds, windowExpiry } from './policy';

// The DB half of the fixed-window limiter (#71). Vercel is serverless and every
// instance is short-lived, so an in-memory counter would reset on each cold start
// and be per-instance besides -- the counter has to be shared state, like
// lib/flights/cache.ts. The window arithmetic is pure and lives in ./policy.ts.

export interface ConsumeOptions {
  bucket: string; // what is being limited, e.g. "coach"
  subject: string; // who is being limited, e.g. an IP or an email
  limit: number; // requests allowed per window
  windowMs: number;
  now?: Date;
}

export interface ConsumeResult {
  allowed: boolean;
  retryAfter: number; // seconds; 0 when allowed
}

/**
 * Count one request against `(bucket, subject)` and say whether it may proceed.
 *
 * The increment is ONE statement: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
 * Postgres holds the row lock across the update, so the returned count is this
 * caller's own position in the window. Read-then-write would let two concurrent
 * requests both read `count = limit` and both proceed — the same race
 * lib/auth/magic.ts avoids for token consumption, and the one that matters most
 * here, since a burst is exactly what a limiter exists to stop.
 */
export async function consume(options: ConsumeOptions): Promise<ConsumeResult> {
  const { bucket, subject, limit, windowMs } = options;
  const now = options.now ?? new Date();
  const key = buildKey(bucket, subject, now, windowMs);
  const expiresAt = windowExpiry(now, windowMs);

  let count: number;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"
    `);
    if (!rows.length || typeof rows[0]?.count !== 'number') {
      // Should be unreachable: the statement always RETURNINGs a row. Treated as
      // a failure rather than assumed-fine, so a silent bypass cannot open here.
      console.error(`[ratelimit] no count returned for ${bucket}; refusing the request.`);
      return { allowed: false, retryAfter: retryAfterSeconds(now, windowMs) };
    }
    count = Number(rows[0].count);
  } catch (error) {
    // FAIL CLOSED, loudly. This limiter guards spend on Gemini and Resend, so
    // degrading to "unlimited" when the counter is unreachable would hand an
    // attacker the bypass: knock the database over, then spend freely. A missing
    // "RateLimit" relation means the migration has not been applied to this
    // environment yet — named here because a bare 503 is undiagnosable.
    console.error(
      `[ratelimit] counter unavailable for ${bucket} — refusing the request. ` +
        'If this says the "RateLimit" relation does not exist, run `prisma migrate deploy` ' +
        'against this environment. Cause:',
      error instanceof Error ? error.message : error,
    );
    return { allowed: false, retryAfter: retryAfterSeconds(now, windowMs) };
  }

  // A count of 1 means this call opened a fresh window, which is the natural
  // moment to collect windows that have since expired — bounded and predictable,
  // rather than a sweep on every request or an unbounded table. The sweep is
  // best-effort: losing it wastes rows, it never wrongly refuses a caller.
  if (count === 1) {
    try {
      await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
    } catch (error) {
      console.warn('[ratelimit] expired-window sweep skipped:', String(error));
    }
  }

  return count <= limit
    ? { allowed: true, retryAfter: 0 }
    : { allowed: false, retryAfter: retryAfterSeconds(now, windowMs) };
}
