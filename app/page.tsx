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
      {user && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 12.5 }}>
            {user.email}
          </span>
          <Link className="btn btn-ghost" href="/profile" style={{ padding: '7px 14px', fontSize: 13 }}>
            Profile
          </Link>
          <LogoutButton />
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <Link className="btn btn-ghost" href="/coach" style={{ padding: '7px 14px', fontSize: 13 }}>
          Jetlag Coach →
        </Link>
      </div>

      <header className="reveal">
        <p className="eyebrow">Jetlag planning for long-haul trips</p>
        <h1 className="wordmark">TimeShift</h1>
        <p className="lede">
          Long flights leave your body clock hours behind your destination. TimeShift takes your
          itinerary and lays the whole journey over daylight and dark where you&rsquo;re landing —
          your flights, your layovers, and the hours that are actually worth sleeping in the air —
          so you arrive closer to local time and spend less of the trip recovering.
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
