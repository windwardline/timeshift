import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { TripView } from '@/components/TripView';
import { TripBuilder } from '@/components/TripBuilder';

// DB-backed: render at request time rather than prerendering at build.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await prisma.user.findFirst({
    where: { email: 'demo@timeshift.app' },
    include: { trips: { orderBy: { createdAt: 'asc' }, take: 1 } },
  });
  const demoTripId = user?.trips[0]?.id;
  const trip = demoTripId && user ? await getTripWithSegments(demoTripId, user.id) : null;

  return (
    <main>
      <header className="reveal">
        <p className="eyebrow">Jetlag, solved before takeoff</p>
        <h1 className="wordmark">TimeShift</h1>
        <p className="lede">
          Crossing time zones wrecks your sleep — and it&rsquo;s genuinely hard to know <em>when</em>{' '}
          to rest. Enter any itinerary and TimeShift maps it against your destination&rsquo;s day and
          night, then tells you exactly when to sleep on the plane.
        </p>
      </header>

      <TripBuilder />

      {trip && trip.segments.length > 0 && (
        <>
          <p className="eyebrow" style={{ margin: '52px 0 0' }}>
            A worked example — JFK → Tokyo via London
          </p>
          <TripView trip={trip} />
        </>
      )}
    </main>
  );
}
