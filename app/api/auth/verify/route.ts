import { NextResponse } from 'next/server';
import { consumeLoginToken } from '@/lib/auth/magic';
import { prisma } from '@/lib/db/prisma';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/current-user';

// US-A2: consume a magic-link token, sign the user in (creating the account on
// first use), and redirect home. An invalid/expired token bounces to login.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const base = process.env.APP_URL ?? new URL(request.url).origin;

  const email = await consumeLoginToken(token);
  if (!email) {
    return NextResponse.redirect(`${base}/login?error=expired`);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, homeTimeZone: 'America/New_York' },
  });

  await setSessionCookie(await createSession(user.id));
  return NextResponse.redirect(base);
}
