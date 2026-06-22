import { z } from 'zod';

// Validates and normalizes registration / login credentials (US-A1): a
// well-formed email (trimmed + lower-cased so uniqueness is case-insensitive)
// and a password of at least 8 characters. PURE.

const schema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export interface Credentials {
  email: string;
  password: string;
}

export type ValidateResult = { ok: true; data: Credentials } | { ok: false; error: string };

export function validateCredentials(raw: unknown): ValidateResult {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // safeParse always reports at least one issue on failure.
    return { ok: false, error: parsed.error.issues[0].message };
  }
  return { ok: true, data: parsed.data };
}
