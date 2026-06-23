import { NextResponse } from 'next/server';
import { validateEmail } from '@/lib/auth/credentials';
import { createLoginToken } from '@/lib/auth/magic';
import { sendMagicLink } from '@/lib/auth/email';

// US-A2 (passwordless): email a one-time sign-in link. The response is generic
// either way so it never reveals whether an account exists.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const valid = validateEmail(body);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const token = await createLoginToken(valid.email);
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  const link = `${base}/api/auth/verify?token=${token}`;

  try {
    await sendMagicLink(valid.email, link);
  } catch (error) {
    console.error('[auth] magic link send failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not send the sign-in email — please try again.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
