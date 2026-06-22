import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getTripWithSegments } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';
import { TripView } from '@/components/TripView';

export const dynamic = 'force-dynamic';

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Ownership-scoped: a trip that isn't yours simply isn't found (US-B4).
  const trip = await getTripWithSegments(id, user.id);
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
