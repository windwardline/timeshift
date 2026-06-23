import { describe, it, expect } from 'vitest';
import { validateEmail } from './credentials';

// US-A1 (passwordless): the magic-link request takes an email only, normalized
// so accounts are case-insensitive.
describe('validateEmail', () => {
  it('accepts and normalizes a valid email', () => {
    const r = validateEmail({ email: '  Traveler@Example.com ' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toBe('traveler@example.com');
  });

  it('rejects a malformed email', () => {
    expect(validateEmail({ email: 'nope' }).ok).toBe(false);
  });

  it('rejects a non-string email', () => {
    expect(validateEmail({ email: 7 }).ok).toBe(false);
  });
});
