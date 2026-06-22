import { cookies } from 'next/headers';
import { getUserBySession } from './session';

export const SESSION_COOKIE = 'ts_session';

const cookieOptions = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

/** The signed-in user for the current request, or null. Server-only. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySession(token);
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
