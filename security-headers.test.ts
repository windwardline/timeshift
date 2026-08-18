import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Headers are platform-applied from vercel.json. This test keeps the contract
// in the repo so a deleted or drifted header fails CI, not a pentest.

function loadRule() {
  const config = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { headers?: { source: string; headers: { key: string; value: string }[] }[] };
  return config.headers?.find((h) => h.source === '/(.*)');
}

const HOUSE_SET = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'X-Frame-Options',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
];

describe('security headers (vercel.json)', () => {
  it('applies a rule to every route', () => {
    expect(loadRule()).toBeDefined();
  });

  it('carries the house seven-header set', () => {
    const rule = loadRule();
    const get = (key: string) => rule?.headers.find((h) => h.key === key)?.value;
    for (const key of HOUSE_SET) expect(get(key), key).toBeTruthy();
    expect(get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(get('X-Content-Type-Options')).toBe('nosniff');
    expect(get('X-Frame-Options')).toBe('DENY');
  });

  it("locks the CSP's dangerous surfaces", () => {
    const rule = loadRule();
    const csp =
      rule?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
    // Both forms (magic-link sign-in, coach) are onSubmit-handled with
    // preventDefault — nothing performs a native form navigation.
    expect(csp).not.toContain('unsafe-eval');
  });

  it("keeps script-src 'unsafe-inline', deliberately (#73)", () => {
    // Recorded decision, not an oversight. Removing it from an App Router app
    // means admitting scripts by per-request nonce, which requires the CSP to be
    // built in middleware — and a nonce only reaches the markup on a page that is
    // rendered per request.
    //
    // Measured on this app: `/coach` and `/privacy` are statically prerendered,
    // so their HTML is built once with no nonce while every response carries a
    // fresh one. Chromium then refused all ten of their script chunks; the pages
    // still rendered their server HTML, so they looked fine, but the Jetlag Coach
    // fired no request when its form was submitted. A headline feature silently
    // inert is a worse outcome than the directive this would remove.
    //
    // Closing it properly means forcing every route dynamic and adding a build
    // check so no future page can regress to static — real cost for a hardening
    // measure with no reachable sink today: the app renders no user-supplied
    // HTML, uses no dangerouslySetInnerHTML, and shows model output as text.
    // Revisit if a page ever renders untrusted markup.
    const csp =
      loadRule()?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });
});
