/*
  Drop the dead `User.passwordHash` column.

  Sign-in moved to passwordless magic links, and nothing has read or written this
  column since: the only references left in the repo were this schema line, the
  historical migrations that created it, and a spec paragraph. The account row is
  created by `app/api/auth/verify` without it, and no code path consults it.

  It still held real bcrypt hashes from before that move, which is what Supabase's
  `sensitive_columns_exposed` advisory pointed at. The lockdown migration
  (20260818204500) made the column unreachable; this removes it, because
  credentials nothing reads should not be retained at all.

  Deliberately a SEPARATE migration from the lockdown: dropping a column cannot be
  undone, and the two Supabase projects are migrated by hand. Bundling it would
  have forced an irreversible change into the same `prisma migrate deploy` run as
  an urgent security fix. The lockdown must be applicable on its own.

  Warning kept from the generator, because it is the point: the data in this
  column is lost when this runs.
*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";
