import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-A2 (passwordless): request-link validates the email, mints a token, and
// emails a link; verify consumes a valid token, signs the user in (creating the
// account on first use), and redirects. The DB, token store, email, session,
// and cookie are the mocked boundaries.
const mocks = vi.hoisted(() => ({
  createLoginToken: vi.fn(),
  consumeLoginToken: vi.fn(),
  sendMagicLink: vi.fn(),
  upsert: vi.fn(),
  createSession: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock('@/lib/auth/magic', () => ({
  createLoginToken: mocks.createLoginToken,
  consumeLoginToken: mocks.consumeLoginToken,
}));
vi.mock('@/lib/auth/email', () => ({ sendMagicLink: mocks.sendMagicLink }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { user: { upsert: mocks.upsert } } }));
vi.mock('@/lib/auth/session', () => ({ createSession: mocks.createSession }));
vi.mock('@/lib/auth/current-user', () => ({ setSessionCookie: mocks.setCookie }));

import { POST as requestLink } from './request-link/route';
import { GET as verify } from './verify/route';

describe('POST /api/auth/request-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = 'http://localhost';
    mocks.createLoginToken.mockResolvedValue('tok123');
    mocks.sendMagicLink.mockResolvedValue(undefined);
  });

  it('mints a token and emails a link for a valid email', async () => {
    const res = await requestLink(
      new Request('http://localhost/api/auth/request-link', {
        method: 'POST',
        body: JSON.stringify({ email: 'Traveler@Example.com' }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.createLoginToken).toHaveBeenCalledWith('traveler@example.com');
    expect(mocks.sendMagicLink).toHaveBeenCalledWith(
      'traveler@example.com',
      'http://localhost/api/auth/verify?token=tok123',
    );
  });

  it('rejects a malformed email with 400 and never sends', async () => {
    const res = await requestLink(
      new Request('http://localhost/api/auth/request-link', {
        method: 'POST',
        body: JSON.stringify({ email: 'nope' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.sendMagicLink).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession.mockResolvedValue('sess');
    mocks.upsert.mockResolvedValue({ id: 'u1' });
  });

  it('signs in and redirects home on a valid token', async () => {
    mocks.consumeLoginToken.mockResolvedValue('traveler@example.com');

    const res = await verify(new Request('http://localhost/api/auth/verify?token=tok123'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/');
    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledWith('u1');
    expect(mocks.setCookie).toHaveBeenCalledWith('sess');
  });

  it('bounces to login on an invalid/expired token', async () => {
    mocks.consumeLoginToken.mockResolvedValue(null);

    const res = await verify(new Request('http://localhost/api/auth/verify?token=bad'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?error=');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
