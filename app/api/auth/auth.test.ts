import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword } from '@/lib/auth/password';

// US-A1/A2 route wiring: register hashes the password and rejects duplicates;
// login verifies credentials and is generic about failures. Real bcrypt is used
// (proving passwords are stored only as a hash); the DB, session, and cookie are
// the only mocked boundaries.
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  createSession: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique, create: mocks.create } },
}));
vi.mock('@/lib/auth/session', () => ({ createSession: mocks.createSession }));
vi.mock('@/lib/auth/current-user', () => ({ setSessionCookie: mocks.setCookie }));

import { POST as register } from './register/route';
import { POST as login } from './login/route';

function call(route: (r: Request) => Promise<Response>, body: unknown) {
  return route(new Request('http://localhost/api/auth', { method: 'POST', body: JSON.stringify(body) }));
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession.mockResolvedValue('tok');
  });

  it('creates a user with a hashed password and starts a session', async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: 'u1' });

    const res = await call(register, { email: 'new@example.com', password: 'supersecret' });

    expect(res.status).toBe(201);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.passwordHash).not.toBe('supersecret');
    expect(data.passwordHash.startsWith('$2')).toBe(true);
    expect(mocks.createSession).toHaveBeenCalledWith('u1');
    expect(mocks.setCookie).toHaveBeenCalledWith('tok');
  });

  it('rejects a duplicate email with 409 and never creates', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'existing' });

    const res = await call(register, { email: 'taken@example.com', password: 'supersecret' });

    expect(res.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects a too-short password with 400', async () => {
    const res = await call(register, { email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession.mockResolvedValue('tok');
  });

  it('logs in with correct credentials', async () => {
    const passwordHash = await hashPassword('supersecret');
    mocks.findUnique.mockResolvedValue({ id: 'u1', passwordHash });

    const res = await call(login, { email: 'me@example.com', password: 'supersecret' });

    expect(res.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith('u1');
  });

  it('rejects a wrong password with a generic 401', async () => {
    const passwordHash = await hashPassword('supersecret');
    mocks.findUnique.mockResolvedValue({ id: 'u1', passwordHash });

    const res = await call(login, { email: 'me@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid email or password.' });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the same generic 401', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await call(login, { email: 'nobody@example.com', password: 'supersecret' });
    expect(res.status).toBe(401);
  });
});
