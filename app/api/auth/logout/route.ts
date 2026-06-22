import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';
import { getSessionToken, clearSessionCookie } from '@/lib/auth/current-user';

// US-A2: log out — destroy the session server-side and clear the cookie.
export async function POST() {
  await destroySession(await getSessionToken());
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
