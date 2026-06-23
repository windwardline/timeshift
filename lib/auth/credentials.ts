import { z } from 'zod';

// Email-only validation for the passwordless magic-link request (US-A1): a
// well-formed email, trimmed + lower-cased so accounts are case-insensitive.
// PURE.
const emailRequestSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email(),
  ),
});

export type EmailResult = { ok: true; email: string } | { ok: false; error: string };

export function validateEmail(raw: unknown): EmailResult {
  const parsed = emailRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  return { ok: true, email: parsed.data.email };
}
