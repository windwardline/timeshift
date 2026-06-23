import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { validateHomeTimeZone } from '@/lib/profile/homeZone';
import { updateUserHomeZone } from '@/lib/db/users';

// Set the signed-in user's home time zone (US-A3). Requires a session; the zone
// is validated against Luxon's IANA database before the thin DB write.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to update your profile.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { homeTimeZone?: unknown } | null;
  const result = validateHomeTimeZone(body?.homeTimeZone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await updateUserHomeZone(user.id, result.data);
  return NextResponse.json({ homeTimeZone: result.data });
}
