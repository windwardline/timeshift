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
const DEMO_TRIP_NAME = 'New York → Tokyo (via London)';

async function main() {
  // Upsert the demo user so re-seeding never duplicates the account.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      // Auth (US-A1) is not built yet; this is a clearly-labeled placeholder,
      // never a real credential.
      passwordHash: 'placeholder-not-a-real-hash',
      homeTimeZone: 'America/New_York',
    },
  });

  // Clear any prior copy of the demo trip (cascades to its segments) so the
  // seed is idempotent across runs.
  await prisma.trip.deleteMany({ where: { userId: user.id, name: DEMO_TRIP_NAME } });

  const trip = await prisma.trip.create({
    data: {
      name: DEMO_TRIP_NAME,
      destination: 'Asia/Tokyo',
      userId: user.id,
      segments: {
        create: [
          {
            sequence: 0,
            departureAirport: 'JFK',
            arrivalAirport: 'LHR',
            departureTime: new Date('2025-06-01T22:00:00Z'), // 18:00 EDT
            arrivalTime: new Date('2025-06-02T05:00:00Z'), // 06:00 BST, 7h flight
            departureTz: 'America/New_York',
            arrivalTz: 'Europe/London',
            departureLat: 40.6413,
            departureLng: -73.7781,
            arrivalLat: 51.47,
            arrivalLng: -0.4543,
          },
          {
            sequence: 1,
            departureAirport: 'LHR',
            arrivalAirport: 'HND',
            departureTime: new Date('2025-06-02T08:00:00Z'), // 09:00 BST, after a 3h layover
            arrivalTime: new Date('2025-06-02T19:30:00Z'), // 04:30 JST next day, 11.5h flight
            departureTz: 'Europe/London',
            arrivalTz: 'Asia/Tokyo',
            departureLat: 51.47,
            departureLng: -0.4543,
            arrivalLat: 35.5494,
            arrivalLng: 139.7798,
          },
        ],
      },
    },
    include: { segments: { orderBy: { sequence: 'asc' } } },
  });

  console.log(
    `Seeded trip ${trip.id} "${trip.name}" (dest ${trip.destination}) ` +
      `with ${trip.segments.length} segments for ${user.email}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
