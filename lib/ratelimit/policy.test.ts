import { describe, it, expect } from 'vitest';
import { buildKey, windowExpiry, retryAfterSeconds } from './policy';

// Pure window arithmetic for the fixed-window limiter (#71). No DB, no clock of
// its own -- `now` is injected, so every case here is deterministic.
const WINDOW = 10 * 60 * 1000; // 10 minutes

describe('buildKey', () => {
  it('keys a bucket and subject to the window the instant falls in', () => {
    const at = new Date('2026-08-18T12:03:00Z');
    expect(buildKey('coach', '1.2.3.4', at, WINDOW)).toBe(
      'coach:6694f83c9f476da31f5df6bcc520034e:2978424',
    );
  });

  it('stores no trace of the subject, which may be an email address', () => {
    // The key is a row's primary key, so an unhashed subject would make
    // `RateLimit` a second table of email addresses -- including addresses of
    // people who never signed up, since anyone can type one in. The limiter only
    // ever compares keys for equality, so a digest serves it exactly as well.
    const at = new Date('2026-08-18T12:03:00Z');
    const key = buildKey('magicLinkEmail', 'victim@example.com', at, WINDOW);
    expect(key).not.toContain('victim');
    expect(key).not.toContain('example.com');
    expect(key).toMatch(/^magicLinkEmail:[0-9a-f]{32}:\d+$/);
  });

  it('keeps the bucket readable, so a log line still says what was limited', () => {
    expect(buildKey('coach', 'x', new Date('2026-08-18T12:03:00Z'), WINDOW)).toMatch(/^coach:/);
  });

  it('keeps two instants in the same window on one key', () => {
    const a = buildKey('coach', '1.2.3.4', new Date('2026-08-18T12:00:00Z'), WINDOW);
    const b = buildKey('coach', '1.2.3.4', new Date('2026-08-18T12:09:59Z'), WINDOW);
    expect(a).toBe(b);
  });

  it('moves to a new key when the window rolls over', () => {
    const a = buildKey('coach', '1.2.3.4', new Date('2026-08-18T12:09:59Z'), WINDOW);
    const b = buildKey('coach', '1.2.3.4', new Date('2026-08-18T12:10:00Z'), WINDOW);
    expect(a).not.toBe(b);
  });

  it('separates subjects, and separates buckets for one subject', () => {
    const at = new Date('2026-08-18T12:00:00Z');
    expect(buildKey('coach', '1.2.3.4', at, WINDOW)).not.toBe(buildKey('coach', '5.6.7.8', at, WINDOW));
    expect(buildKey('coach', '1.2.3.4', at, WINDOW)).not.toBe(buildKey('advice', '1.2.3.4', at, WINDOW));
  });

  it('separates subjects that would collide once concatenated', () => {
    // "a:b" + "c" and "a" + "b:c" must not land on one bucket.
    const at = new Date('2026-08-18T12:00:00Z');
    expect(buildKey('coach', 'a:b', at, WINDOW)).not.toBe(buildKey('coach:a', 'b', at, WINDOW));
  });
});

describe('windowExpiry', () => {
  it('expires at the end of the window the instant falls in', () => {
    expect(windowExpiry(new Date('2026-08-18T12:03:00Z'), WINDOW)).toEqual(
      new Date('2026-08-18T12:10:00Z'),
    );
  });
});

describe('retryAfterSeconds', () => {
  it('reports whole seconds until the window rolls over', () => {
    expect(retryAfterSeconds(new Date('2026-08-18T12:03:00Z'), WINDOW)).toBe(420);
  });

  it('never reports zero, so a client is never told to retry immediately', () => {
    expect(retryAfterSeconds(new Date('2026-08-18T12:09:59.500Z'), WINDOW)).toBe(1);
  });
});
