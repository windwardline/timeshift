import { prisma } from './prisma';

// Thin persistence for user-profile fields (US-A3). Like the other lib/db
// wrappers (createTrip, listTrips), this is the mocked boundary in route tests.
export async function updateUserHomeZone(userId: string, homeTimeZone: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { homeTimeZone } });
}
