import { prisma } from '@/lib/db/prisma';
import { getTripWithSegments } from '@/lib/db/trips';
import { assembleTimeline } from '@/lib/engine/timeline';
import { dayNightArcs } from '@/lib/engine/arcs';
import { recommendSleepWindows } from '@/lib/engine/sleep';
import { offsetMinutes } from '@/lib/engine/time';
import { Timeline } from '@/components/Timeline';

// DB-backed: render at request time rather than prerendering at build.
export const dynamic = 'force-dynamic';

// The demo timeline page. It runs the real DB -> engine pipeline: the
// ownership-scoped getTripWithSegments hands the engine an ordered list of legs,
// and the engine produces the timeline, day/night arcs, and sleep windows the
// page renders. Server component — Prisma and the engine run on the server.
export default async function Home() {
  const user = await prisma.user.findFirst({
    where: { email: 'demo@timeshift.app' },
    include: { trips: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const demoTripId = user?.trips[0]?.id;
  const trip = demoTripId && user ? await getTripWithSegments(demoTripId, user.id) : null;

  if (!user || !trip || trip.segments.length === 0) {
    return (
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <h1>TimeShift</h1>
        <p>No demo trip found. Run <code>npm run seed</code> to create one.</p>
      </main>
    );
  }

  const timeline = assembleTimeline(trip);
  const layovers = timeline.items.filter((i) => i.kind === 'layover');
  const last = trip.segments[trip.segments.length - 1];
  const arcs =
    last.arrivalLat != null && last.arrivalLng != null
      ? dayNightArcs(timeline.start, timeline.end, trip.destination, last.arrivalLat, last.arrivalLng)
      : [];
  const sleep = recommendSleepWindows(timeline, user.homeTimeZone, trip.destination);

  const deltaMinutes =
    offsetMinutes(last.arrivalTime, trip.destination) -
    offsetMinutes(trip.segments[0].departureTime, trip.segments[0].departureTz);
  const deltaHours = (deltaMinutes / 60).toFixed(1);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 1040, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 4 }}>TimeShift</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        {trip.name} · home {user.homeTimeZone} → destination {trip.destination} · clock shift{' '}
        {deltaMinutes >= 0 ? '+' : ''}
        {deltaHours}h
      </p>

      <Timeline
        axisStart={timeline.start}
        axisEnd={timeline.end}
        flights={trip.segments}
        layovers={layovers}
        arcs={arcs}
        sleep={sleep}
        destTz={trip.destination}
      />

      <p style={{ color: '#64748b', fontSize: 13, marginTop: 12 }}>
        Warm bands are daylight at the destination, dark bands night; blue bars are flights, hatched
        blocks layovers, and the shaded {'☾'} spans are recommended in-flight sleep windows.
      </p>
    </main>
  );
}
