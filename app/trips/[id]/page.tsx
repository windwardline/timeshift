import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { TripView } from '@/components/TripView';

export const dynamic = 'force-dynamic';

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // No auth yet (Phase 7): scope to the demo user, the owner of created trips.
  const user = await prisma.user.findFirst({ where: { email: 'demo@timeshift.app' } });
  const trip = user ? await getTripWithSegments(id, user.id) : null;
  if (!trip || trip.segments.length === 0) {
    notFound();
  }

  return (
    <main>
      <header className="reveal" style={{ marginBottom: 8 }}>
        <p className="eyebrow">
          <Link href="/">← TimeShift</Link>
        </p>
      </header>
      <TripView trip={trip} />
    </main>
  );
}
