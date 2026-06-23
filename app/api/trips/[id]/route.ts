import { NextResponse } from 'next/server';
import { renameTrip, deleteTrip } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';

// Rename a trip (US-B3). Requires a session; the write is ownership-scoped, so a
// trip that isn't the caller's affects 0 rows → 404 (US-B4), no existence leak.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to edit a trip.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Please give the trip a name.' }, { status: 400 });
  }

  const { count } = await renameTrip(id, user.id, name);
  if (count === 0) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }
  return NextResponse.json({ id, name });
}

// Delete a trip (US-B3), ownership-scoped like the rename above.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to edit a trip.' }, { status: 401 });
  }

  const { count } = await deleteTrip(id, user.id);
  if (count === 0) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
