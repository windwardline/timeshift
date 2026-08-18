// Who gets limited, and by how much (#71). Pure policy, kept out of the routes so
// the numbers are reviewable in one place and pinned by tests.

const MINUTE = 60 * 1000;

export interface LimitSpec {
  limit: number;
  windowMs: number;
}

/**
 * Allowances for the endpoints that take unauthenticated input and spend money
 * on a third party. Session-gated routes are not listed: sign-in already bounds
 * them. Generous enough that no real visitor meets them -- the target is the
 * scripted loop, not the curious reader.
 *
 * Overridable per environment, like the coach thresholds in app/api/coach/route.ts.
 */
function fromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const LIMITS: Record<string, LimitSpec> = {
  // Each call is an embedding plus a generation on the owner's GCP project.
  coach: { limit: fromEnv('RATELIMIT_COACH', 20), windowMs: 10 * MINUTE },
  // The showcase trip's advice is open to non-owners; same model, same bill.
  advice: { limit: fromEnv('RATELIMIT_ADVICE', 10), windowMs: 10 * MINUTE },
  // Per caller: blunts a scripted loop against many addresses.
  magicLinkIp: { limit: fromEnv('RATELIMIT_MAGIC_LINK_IP', 10), windowMs: 60 * MINUTE },
  // Per recipient, and stricter: the abuse here is mail landing in someone else's
  // inbox, so the address being mailed is the thing that needs protecting.
  magicLinkEmail: { limit: fromEnv('RATELIMIT_MAGIC_LINK_EMAIL', 5), windowMs: 60 * MINUTE },
};

/**
 * The calling client's address. Vercel terminates TLS upstream, so the socket
 * address is a proxy; `x-forwarded-for` carries the chain and its first hop is
 * the client.
 *
 * The header is spoofable in principle, but on Vercel it is rewritten at the edge
 * rather than passed through, so a client cannot forge its own first hop. Callers
 * with no address at all share one bucket instead of going unlimited: a limiter
 * that can be switched off by dropping a header is not a limiter.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
