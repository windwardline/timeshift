import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { TripView } from '@/components/TripView';

// DB-backed: render at request time rather than prerendering at build.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await prisma.user.findFirst({
    where: { email: 'demo@timeshift.app' },
    include: { trips: { orderBy: { createdAt: 'desc' }, take: 1 } },
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
          to rest. TimeShift maps your itinerary against your destination&rsquo;s day and night, then
          tells you exactly when to sleep on the plane.
        </p>
      </header>

      {user && trip && trip.segments.length > 0 ? (
        <TripView trip={trip} homeTimeZone={user.homeTimeZone} />
      ) : (
        <section className="card" style={{ marginTop: 24, padding: 24 }}>
          <p style={{ margin: 0 }}>
            No trip to show yet. Run <code className="mono">npm run seed</code> to create the demo
            itinerary.
          </p>
        </section>
      )}
    </main>
  );
}
