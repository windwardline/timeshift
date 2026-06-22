import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validateCredentials } from '@/lib/auth/credentials';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/current-user';

// US-A1: register with a unique email + password (stored only as a bcrypt hash),
// and start a session.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const valid = validateCredentials(body);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: valid.data.email } });
  if (existing) {
    return NextResponse.json({ error: 'That email is already registered.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email: valid.data.email,
      passwordHash: await hashPassword(valid.data.password),
      homeTimeZone: 'America/New_York',
    },
  });

  await setSessionCookie(await createSession(user.id));
  return NextResponse.json({ id: user.id }, { status: 201 });
}
