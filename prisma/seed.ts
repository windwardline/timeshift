import { PrismaClient } from '@prisma/client';

// Standalone demo seed: one traveler with one multi-leg trip, so the timeline
// page has real data to render. Run with `npm run seed`. Idempotent — safe to
// re-run before a demo. Timestamps are UTC; the IANA zone is stored alongside
// each end of every leg (CLAUDE.md §4), and airport coordinates are included so
// SunCalc day/night arcs resolve precisely at the destination.
//
// Mirrors lib/db/trips.ts#createTrip (nested write). The seed keeps its own
// client rather than importing the repo so it runs as a plain Node script.

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@timeshift.app';
const DEMO_TRIP_NAME = 'New York → Singapore (BA, via London)';

async function main() {
  // Upsert the demo user so re-seeding never duplicates the account.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      homeTimeZone: 'America/New_York',
    },
  });

  // The demo account holds only the showcase trip; clear any prior trips
  // (cascades to segments) so re-seeding is idempotent even if the name changes.
  await prisma.trip.deleteMany({ where: { userId: user.id } });

  const trip = await prisma.trip.create({
    data: {
      name: DEMO_TRIP_NAME,
      destination: 'Asia/Singapore',
      userId: user.id,
      segments: {
        create: [
          {
            sequence: 0,
            flightNumber: 'BA 178',
            departureAirport: 'JFK',
            arrivalAirport: 'LHR',
            departureTime: new Date('2025-07-02T01:30:00Z'), // 21:30 EDT Jul 1
            arrivalTime: new Date('2025-07-02T08:20:00Z'), // 09:20 BST, ~6h50
            departureTz: 'America/New_York',
            arrivalTz: 'Europe/London',
            departureLat: 40.6413,
            departureLng: -73.7781,
            arrivalLat: 51.47,
            arrivalLng: -0.4543,
          },
          {
            sequence: 1,
            flightNumber: 'BA 11',
            departureAirport: 'LHR',
            arrivalAirport: 'SIN',
            departureTime: new Date('2025-07-02T10:40:00Z'), // 11:40 BST, after a ~2h20 layover
            arrivalTime: new Date('2025-07-02T23:30:00Z'), // 07:30 SGT next day, ~12h50
            departureTz: 'Europe/London',
            arrivalTz: 'Asia/Singapore',
            departureLat: 51.47,
            departureLng: -0.4543,
            arrivalLat: 1.3644,
            arrivalLng: 103.9915,
          },
        ],
      },
    },
    include: { segments: { orderBy: { sequence: 'asc' } } },
  });

  // A second showcase that crosses the International Date Line (US-E3): LAX → SYD
  // eastbound "gains" a day — the local calendar leaps two days while the flight
  // spans one — so the engine's crossesDateLine fact reads true here (it is false
  // for the Singapore trip above). One nonstop leg keeps the example legible.
  const idl = await prisma.trip.create({
    data: {
      name: 'Los Angeles → Sydney (QF, across the date line)',
      destination: 'Australia/Sydney',
      userId: user.id,
      segments: {
        create: [
          {
            sequence: 0,
            flightNumber: 'QF 12',
            departureAirport: 'LAX',
            arrivalAirport: 'SYD',
            departureTime: new Date('2025-07-02T05:30:00Z'), // 22:30 PDT Jul 1
            arrivalTime: new Date('2025-07-02T20:30:00Z'), // 06:30 AEST Jul 3 (+2 cal days)
            departureTz: 'America/Los_Angeles',
            arrivalTz: 'Australia/Sydney',
            departureLat: 33.9416,
            departureLng: -118.4085,
            arrivalLat: -33.9399,
            arrivalLng: 151.1753,
          },
        ],
      },
    },
    include: { segments: true },
  });

  console.log(
    `Seeded trip ${trip.id} "${trip.name}" (dest ${trip.destination}) ` +
      `with ${trip.segments.length} segments and trip ${idl.id} "${idl.name}" ` +
      `(dest ${idl.destination}) with ${idl.segments.length} segment for ${user.email}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
