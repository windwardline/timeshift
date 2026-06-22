import bcrypt from 'bcryptjs';

// Thin wrapper over bcrypt (CLAUDE.md §9: vetted hashing, never hand-rolled).
// Passwords are stored only as a salted hash (US-A1).
const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
