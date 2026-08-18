import { describe, it, expect, beforeEach, vi } from 'vitest';

// The three endpoints that are open by design (#71): each must count the caller
// and refuse past the limit with 429 + Retry-After, and must not spend on the
// third party when refusing. `consume` is the mocked boundary.
const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  answerQuestion: vi.fn(),
  sendMagicLink: vi.fn(),
  createLoginToken: vi.fn(),
  getTripWithOwner: vi.fn(),
  getCurrentUser: vi.fn(),
  generateAdvice: vi.fn(),
}));

vi.mock('@/lib/ratelimit/limit', () => ({ consume: mocks.consume }));
vi.mock('@/lib/ai/coach', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/coach')>()),
  answerQuestion: mocks.answerQuestion,
}));
vi.mock('@/lib/rag/corpus', () => ({ loadCorpus: () => ({ chunks: [], vectors: [], sources: {} }) }));
vi.mock('@/lib/rag/embed', () => ({ embedQuery: vi.fn(), EMBED_MODEL: 'm', EMBED_DIM: 1 }));
vi.mock('@/lib/ai/client', () => ({ createGeminiClient: () => ({ complete: vi.fn() }) }));
vi.mock('@/lib/auth/email', () => ({ sendMagicLink: mocks.sendMagicLink }));
vi.mock('@/lib/auth/magic', () => ({ createLoginToken: mocks.createLoginToken }));
vi.mock('@/lib/db/trips', () => ({ getTripWithOwner: mocks.getTripWithOwner }));
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/ai/advice', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/advice')>()),
  generateAdvice: mocks.generateAdvice,
}));

import { POST as coachPost } from './coach/route';
import { POST as linkPost } from './auth/request-link/route';
import { POST as advicePost } from './trips/[id]/advice/route';

const ALLOW = { allowed: true, retryAfter: 0 };
const DENY = { allowed: false, retryAfter: 420 };

const jsonReq = (url: string, body: unknown, ip = '1.2.3.4') =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'https://timeshift.test';
  process.env.GEMINI_API_KEY = 'test-key';
  mocks.consume.mockResolvedValue(ALLOW);
  mocks.answerQuestion.mockResolvedValue({ grounded: true, answer: 'a', sources: [] });
  mocks.createLoginToken.mockResolvedValue('tok');
  mocks.sendMagicLink.mockResolvedValue(undefined);
  mocks.generateAdvice.mockResolvedValue({ plan: 'p' });
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.getTripWithOwner.mockResolvedValue({
    id: 't1',
    userId: 'demo',
    destination: 'Europe/London',
    user: { email: 'demo@timeshift.app' },
    segments: [
      {
        sequence: 0, departureAirport: 'JFK', arrivalAirport: 'LHR',
        departureTime: new Date('2026-07-01T23:00:00Z'), arrivalTime: new Date('2026-07-02T06:00:00Z'),
        departureTz: 'America/New_York', arrivalTz: 'Europe/London',
      },
    ],
  });
});

describe('POST /api/coach', () => {
  it('refuses past the limit with 429 and Retry-After, without calling the model', async () => {
    mocks.consume.mockResolvedValue(DENY);
    const res = await coachPost(jsonReq('http://localhost/api/coach', { question: 'why jetlag?' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('420');
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
  });

  it('counts the caller by IP against the coach bucket', async () => {
    await coachPost(jsonReq('http://localhost/api/coach', { question: 'why jetlag?' }, '9.9.9.9'));
    expect(mocks.consume).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'coach', subject: '9.9.9.9' }),
    );
  });

  it('answers normally while within the limit', async () => {
    const res = await coachPost(jsonReq('http://localhost/api/coach', { question: 'why jetlag?' }));
    expect(res.status).toBe(200);
    expect(mocks.answerQuestion).toHaveBeenCalled();
  });

  it('rejects a malformed body before spending a limiter slot', async () => {
    const res = await coachPost(jsonReq('http://localhost/api/coach', { question: '' }));
    expect(res.status).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/request-link', () => {
  const body = { email: 'victim@example.com' };

  it('refuses past the per-caller limit without sending mail', async () => {
    mocks.consume.mockResolvedValue(DENY);
    const res = await linkPost(jsonReq('http://localhost/api/auth/request-link', body));
    expect(res.status).toBe(429);
    expect(mocks.sendMagicLink).not.toHaveBeenCalled();
  });

  it('limits per recipient as well as per caller', async () => {
    await linkPost(jsonReq('http://localhost/api/auth/request-link', body));
    const buckets = mocks.consume.mock.calls.map((c) => c[0].bucket);
    expect(buckets).toContain('magicLinkIp');
    expect(buckets).toContain('magicLinkEmail');
    const perEmail = mocks.consume.mock.calls.find((c) => c[0].bucket === 'magicLinkEmail');
    expect(perEmail?.[0].subject).toBe('victim@example.com');
  });

  it('refuses when the recipient is over their limit even if the caller is not', async () => {
    mocks.consume.mockImplementation(async ({ bucket }: { bucket: string }) =>
      bucket === 'magicLinkEmail' ? DENY : ALLOW,
    );
    const res = await linkPost(jsonReq('http://localhost/api/auth/request-link', body));
    expect(res.status).toBe(429);
    expect(mocks.sendMagicLink).not.toHaveBeenCalled();
  });

  it('does not mint a login token when refusing', async () => {
    mocks.consume.mockResolvedValue(DENY);
    await linkPost(jsonReq('http://localhost/api/auth/request-link', body));
    expect(mocks.createLoginToken).not.toHaveBeenCalled();
  });

  it('does not spend the caller\'s allowance when the server is misconfigured', async () => {
    // Preview leaves APP_URL unset on purpose, so this route 500s there by
    // design. Counting those attempts would burn a real person's hourly
    // allowance -- and a database write -- on a request the server was never
    // going to honour.
    delete process.env.APP_URL;
    const res = await linkPost(jsonReq('http://localhost/api/auth/request-link', body));
    expect(res.status).toBe(500);
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it('sends normally while within both limits', async () => {
    const res = await linkPost(jsonReq('http://localhost/api/auth/request-link', body));
    expect(res.status).toBe(200);
    expect(mocks.sendMagicLink).toHaveBeenCalled();
  });
});

describe('POST /api/trips/[id]/advice', () => {
  const params = Promise.resolve({ id: 't1' });

  it('refuses past the limit on the public showcase trip, without calling the model', async () => {
    mocks.consume.mockResolvedValue(DENY);
    const res = await advicePost(new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4' } }), { params });
    expect(res.status).toBe(429);
    expect(mocks.generateAdvice).not.toHaveBeenCalled();
  });

  it('does not spend the caller\'s allowance when the model is not configured', async () => {
    // Mirrors the APP_URL ordering on /api/auth/request-link. A deployment with
    // no key 503s without spending anything upstream, so charging anonymous
    // callers for it would hand real visitors 429s on the showcase trip for a
    // limit they never hit.
    delete process.env.GEMINI_API_KEY;
    const res = await advicePost(new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4' } }), { params });
    expect(res.status).toBe(503);
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it('does not spend a limiter slot for a signed-in owner', async () => {
    // Owners are already bounded by their session; only the open showcase path
    // is a spend vector for anonymous callers.
    mocks.getCurrentUser.mockResolvedValue({ id: 'demo' });
    mocks.getTripWithOwner.mockResolvedValue({
      ...(await mocks.getTripWithOwner()),
      userId: 'demo',
      user: { email: 'owner@example.com' },
    });
    await advicePost(new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4' } }), { params });
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
