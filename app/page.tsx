import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { getCurrentUser } from '@/lib/auth/current-user';
import { TripView } from '@/components/TripView';
import { TripBuilder } from '@/components/TripBuilder';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

// Captions for the public showcase trips, keyed by destination zone. The second
// trip crosses the date line, so the two examples together show the engine
// handling both the everyday case and the IDL edge case.
const SHOWCASE_CAPTIONS: Record<string, string> = {
  'Asia/Singapore': 'A worked example — JFK → Singapore via London',
  'Australia/Sydney': 'Crossing the date line — Los Angeles → Sydney',
};

// The seeded demo trips, rendered as public showcases (owned by the demo
// account; served directly here, not via the ownership-scoped path).
async function getShowcaseTrips() {
  const demo = await prisma.user.findFirst({
    where: { email: 'demo@timeshift.app' },
    include: { trips: { orderBy: { createdAt: 'asc' } } },
  });
  if (!demo) return [];
  const trips = await Promise.all(demo.trips.map((t) => getTripWithSegments(t.id, demo.id)));
  return trips.filter((t): t is NonNullable<typeof t> => !!t && t.segments.length > 0);
}

export default async function Home() {
  const user = await getCurrentUser();
  const showcases = await getShowcaseTrips();

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

      <section
        className="card reveal-2"
        style={{
          marginTop: 24,
          padding: '18px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          background:
            'linear-gradient(120deg, rgba(120,160,255,0.12), rgba(180,120,255,0.10))',
          borderColor: 'rgba(140,170,255,0.35)',
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            New · Jetlag Coach
          </p>
          <p style={{ margin: 0, color: '#d6daf6', lineHeight: 1.55 }}>
            Ask any jetlag or sleep question and get a grounded answer drawn from a curated
            knowledge base — with a next-step suggestion and links to authoritative sources
            (CDC, NHS, Sleep Foundation).
          </p>
        </div>
        <Link className="btn" href="/coach" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
          Ask the Jetlag Coach →
        </Link>
      </section>

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

      {showcases.map((trip) => (
        <section key={trip.id} data-testid={`showcase-${trip.destination.replace('/', '-')}`}>
          <p className="eyebrow" style={{ margin: '52px 0 0' }}>
            {SHOWCASE_CAPTIONS[trip.destination] ?? `A worked example — ${trip.name}`}
          </p>
          <TripView trip={trip} />
        </section>
      ))}
    </main>
  );
}
