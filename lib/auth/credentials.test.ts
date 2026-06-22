import { describe, it, expect } from 'vitest';
import { validateCredentials } from './credentials';

// US-A1: registration requires a valid email and a password of at least 8
// characters; the email is normalized so uniqueness is case-insensitive.
describe('validateCredentials', () => {
  it('accepts a valid email + 8+ char password and normalizes the email', () => {
    const result = validateCredentials({ email: '  Alice@Example.com ', password: 'supersecret' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email).toBe('alice@example.com');
    expect(result.data.password).toBe('supersecret');
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(validateCredentials({ email: 'a@b.com', password: 'short' }).ok).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(validateCredentials({ email: 'not-an-email', password: 'supersecret' }).ok).toBe(false);
  });
});
