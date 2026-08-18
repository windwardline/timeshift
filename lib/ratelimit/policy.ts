import { createHash } from 'node:crypto';

// Fixed-window rate limiting, the pure half (#71). No DB, no framework, no clock
// of its own: `now` is always injected, so every unit here is deterministic and
// unit-testable, the same way lib/engine/ is. The DB half lives in ./limit.ts.

/** The index of the fixed window an instant falls in. */
function windowIndex(now: Date, windowMs: number): number {
  return Math.floor(now.getTime() / windowMs);
}

/**
 * The storage key for one (bucket, subject) pair in the window `now` falls in.
 *
 * The subject is hashed, not stored. This key is a row's primary key, so keeping
 * the subject in clear would turn `RateLimit` into a second table of email
 * addresses — including addresses of people who never signed up, since anyone can
 * type one into the sign-in form. The limiter only ever compares keys for
 * equality, so a digest serves it identically while retaining nothing. Same
 * reasoning as dropping the dead `passwordHash` column: data nothing reads should
 * not be kept.
 *
 * Hashing also removes the separator hazard that percent-encoding covered before:
 * a digest is fixed-length hex, so `("coach", "a:b")` and `("coach:a", "b")`
 * cannot flatten onto one key. The bucket stays readable so a log line still says
 * what was limited.
 *
 * Not a secret-keeping measure: the input space of IPv4 is small enough to
 * enumerate, so this is data minimisation, not anonymisation.
 */
function hashSubject(subject: string): string {
  return createHash('sha256').update(subject).digest('hex').slice(0, 32);
}

export function buildKey(bucket: string, subject: string, now: Date, windowMs: number): string {
  return `${encodeURIComponent(bucket)}:${hashSubject(subject)}:${windowIndex(now, windowMs)}`;
}

/** When the current window ends — the row's expiry, so old windows are collectable. */
export function windowExpiry(now: Date, windowMs: number): Date {
  return new Date((windowIndex(now, windowMs) + 1) * windowMs);
}

/**
 * Whole seconds until the window rolls over, for the `Retry-After` header.
 * Rounded up and floored at 1: telling a client to retry in 0 seconds would
 * invite an immediate retry that is certain to be refused again.
 */
export function retryAfterSeconds(now: Date, windowMs: number): number {
  const msLeft = windowExpiry(now, windowMs).getTime() - now.getTime();
  return Math.max(1, Math.ceil(msLeft / 1000));
}
