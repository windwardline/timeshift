import { describe, it, expect, vi } from 'vitest';
import { LIMITS, clientIp } from './config';

// The limits themselves, plus how a caller is identified. Both are policy, both
// are pure, so both are pinned here rather than left implicit in the routes.

describe('LIMITS', () => {
  it('covers every endpoint that is open by design and spends on a third party', () => {
    expect(Object.keys(LIMITS).sort()).toEqual(['advice', 'coach', 'magicLinkEmail', 'magicLinkIp']);
  });

  it('gives each bucket a positive allowance and a positive window', () => {
    for (const [name, limit] of Object.entries(LIMITS)) {
      expect(limit.limit, name).toBeGreaterThan(0);
      expect(limit.windowMs, name).toBeGreaterThan(0);
    }
  });

  it('limits magic-link sends per recipient more tightly than per caller', () => {
    // The abuse target is the person receiving the mail, not the caller sending
    // it, so the per-email allowance is the stricter of the two.
    expect(LIMITS.magicLinkEmail.limit).toBeLessThanOrEqual(LIMITS.magicLinkIp.limit);
  });
});

describe('env overrides', () => {
  // Re-imported per case: LIMITS is evaluated once at module load.
  async function limitsWith(env: Record<string, string>) {
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    vi.resetModules();
    const mod = await import('./config');
    for (const k of Object.keys(env)) delete process.env[k];
    return mod.LIMITS;
  }

  it('takes a positive override from the environment', async () => {
    expect((await limitsWith({ RATELIMIT_COACH: '3' })).coach.limit).toBe(3);
  });

  it('ignores a non-positive override rather than disabling the limit', async () => {
    // `RATELIMIT_COACH=0` must not mean "unlimited" -- a limiter that can be
    // switched off by a stray env value is worse than no limiter, because it
    // looks present.
    expect((await limitsWith({ RATELIMIT_COACH: '0' })).coach.limit).toBe(20);
  });

  it('ignores an unparseable override', async () => {
    expect((await limitsWith({ RATELIMIT_COACH: 'lots' })).coach.limit).toBe(20);
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) =>
    new Request('http://localhost/api/coach', { headers });

  it('takes the first hop of x-forwarded-for, which is the real client', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' }))).toBe('1.2.3.4');
  });

  it('trims whitespace around the hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '  1.2.3.4  , 10.0.0.1' }))).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when there is no forwarded chain', () => {
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('returns a single shared bucket when no address is present at all', () => {
    // Anonymous callers share one bucket rather than each getting a free pass.
    // Stricter than per-IP, and unreachable behind Vercel, which always sets the
    // header -- but a limiter must not be disabled by simply omitting a header.
    expect(clientIp(req({}))).toBe('unknown');
  });

  it('ignores an empty forwarded header rather than keying on empty string', () => {
    expect(clientIp(req({ 'x-forwarded-for': '   ' }))).toBe('unknown');
  });
});
