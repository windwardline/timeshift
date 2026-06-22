import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validateCredentials } from '@/lib/auth/credentials';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/current-user';

// US-A2: authenticate with correct credentials. A wrong email or password gives
// the same generic message — no hint about which field was wrong.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const valid = validateCredentials(body);
  if (!valid.ok) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: valid.data.email } });
  if (!user || !(await verifyPassword(valid.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  await setSessionCookie(await createSession(user.id));
  return NextResponse.json({ id: user.id }, { status: 200 });
}
