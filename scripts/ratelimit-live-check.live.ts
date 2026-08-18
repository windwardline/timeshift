import { describe, expect, it } from 'vitest';
import { consume } from '../lib/ratelimit/limit';

// Live check for the fixed-window limiter (#71). NOT part of the default suite —
// it needs a real Postgres with the migrations applied, which CI does not have.
// Run it deliberately:
//
//   DATABASE_URL=postgres://... npm run ratelimit:check
//
// The unit suite pins the SHAPE of the increment statement
// (lib/ratelimit/limit.test.ts). Only a real database can show the property that
// shape exists for: a burst of concurrent callers admitted exactly to the limit,
// where a read-then-write increment would let most of them through.

const LIMIT = 5;
const WINDOW_MS = 600_000;
const NOW = new Date('2026-08-18T12:03:00Z');
const stamp = Date.now(); // fresh subjects per run, so reruns do not collide

const run = (subject: string, now = NOW) =>
  consume({ bucket: 'coach', subject, limit: LIMIT, windowMs: WINDOW_MS, now });

describe(`rate limiter against a live database (limit ${LIMIT} per ${WINDOW_MS}ms)`, () => {
  it('admits exactly the limit over 8 sequential requests, then refuses', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 8; i += 1) results.push((await run(`seq-${stamp}`)).allowed);
    expect(results.map((a) => (a ? 'A' : 'D')).join('')).toBe('AAAAADDD');
  });

  it('admits exactly the limit when 40 requests arrive at once', async () => {
    // The load-bearing case. A read-then-write increment lets most of these
    // observe the same pre-limit count and pass.
    const burst = await Promise.all(Array.from({ length: 40 }, () => run(`burst-${stamp}`)));
    expect(burst.filter((r) => r.allowed)).toHaveLength(LIMIT);
    expect(burst.find((r) => !r.allowed)?.retryAfter).toBe(420);
  });

  it('admits the caller again once the window rolls over', async () => {
    const rolled = await run(`seq-${stamp}`, new Date(NOW.getTime() + WINDOW_MS));
    expect(rolled.allowed).toBe(true);
  });

  it('keeps separate subjects independent', async () => {
    expect((await run(`other-${stamp}`)).allowed).toBe(true);
  });
});
