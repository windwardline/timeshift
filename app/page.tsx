import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';
import { TripView } from '@/components/TripView';
import { TripBuilder } from '@/components/TripBuilder';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

// The seeded demo trip, rendered as a public showcase (owned by the demo
// account; served directly here, not via the ownership-scoped path).
async function getShowcaseTrip() {
  const demo = await prisma.user.findFirst({
    where: { email: 'demo@timeshift.app' },
    include: { trips: { orderBy: { createdAt: 'asc' }, take: 1 } },
  });
  const tripId = demo?.trips[0]?.id;
  return tripId && demo ? getTripWithSegments(tripId, demo.id) : null;
}

export default async function Home() {
  const user = await getCurrentUser();
  const showcase = await getShowcaseTrip();

  return (
    <main>
      {user && <LogoutButton email={user.email} />}

      <header className="reveal">
        <p className="eyebrow">Jetlag, solved before takeoff</p>
        <h1 className="wordmark">TimeShift</h1>
        <p className="lede">
          Crossing time zones wrecks your sleep — and it&rsquo;s genuinely hard to know <em>when</em>{' '}
          to rest. Enter any itinerary and TimeShift maps it against your destination&rsquo;s day and
          night, then tells you exactly when to sleep on the plane.
        </p>
      </header>

      {user ? (
        <TripBuilder />
      ) : (
        <section className="card reveal-2" style={{ marginTop: 28, padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Build your own journey
          </p>
          <p style={{ margin: '0 0 16px', color: '#d6daf6' }}>
            Sign in with just your email — no password — to enter your own flights, save them, and
            get a personalized AI jetlag plan for each trip.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link className="btn" href="/login">
              Sign in with email
            </Link>
          </div>
        </section>
      )}

      {showcase && showcase.segments.length > 0 && (
        <>
          <p className="eyebrow" style={{ margin: '52px 0 0' }}>
            A worked example — JFK → Tokyo via London
          </p>
          <TripView trip={showcase} />
        </>
      )}
    </main>
  );
}
