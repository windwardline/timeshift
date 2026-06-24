import { NextResponse } from 'next/server';
import { updateSegment, deleteSegment } from '@/lib/db/trips';
import { normalizeSegmentInput } from '@/lib/trips/normalize';
import { getCurrentUser } from '@/lib/auth/current-user';

// Edit a flight leg (US-C3). Requires a session; the write is ownership-scoped
// through the parent trip, so a leg that isn't the caller's affects 0 rows → 404
// (US-B4). Times are re-validated and UTC-normalized by the shared pure validator.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; segId: string }> }) {
  const { id, segId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to edit a trip.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = normalizeSegmentInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { count } = await updateSegment(id, user.id, segId, result.data);
  if (count === 0) {
    return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  }
  return NextResponse.json({ id: segId });
}

// Delete a flight leg (US-C3); the repo resequences the remaining legs. Scoped
// like the edit above.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; segId: string }> }) {
  const { id, segId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to edit a trip.' }, { status: 401 });
  }

  const { count } = await deleteSegment(id, user.id, segId);
  if (count === 0) {
    return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
