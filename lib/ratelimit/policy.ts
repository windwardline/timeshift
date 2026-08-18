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
 * Both parts are percent-encoded before joining. Without that, a subject
 * containing the separator would let one caller land in another's bucket:
 * `("coach", "a:b")` and `("coach:a", "b")` both flatten to `coach:a:b:<n>`.
 * An IP never contains a colon, but an email — the subject used to limit
 * magic-link sends per recipient — is attacker-supplied, so this is load-bearing.
 */
export function buildKey(bucket: string, subject: string, now: Date, windowMs: number): string {
  return `${encodeURIComponent(bucket)}:${encodeURIComponent(subject)}:${windowIndex(now, windowMs)}`;
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
