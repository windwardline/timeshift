// The migrations that make up the public-schema lockdown: everything from the
// first lockdown migration onward.
//
// One definition, three consumers — scripts/generate-supabase-sql.mjs writes them
// into docs/supabase-lockdown.sql, scripts/verify-lockdown.mjs checks a database
// has them, and supabase-lockdown-sql.test.ts gates the generated file against
// them. Derived from the directory rather than listed, because a hand-kept list
// omits a new migration silently: absence is not an error, so the browser path
// would lock down the old tables and leave the new one published, and the
// verifier would report "locked down" for a database missing the newest one.
import { readdirSync } from 'node:fs';

/** The first migration of the lockdown; everything from here on belongs to it. */
export const LOCKDOWN_FLOOR = '20260818204500';

/**
 * @param {string} [dir] path to prisma/migrations; defaults to the CWD-relative one
 * @returns {string[]} migration directory names, oldest first
 */
export function lockdownMigrations(dir = 'prisma/migrations') {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .filter((name) => name >= LOCKDOWN_FLOOR);
}
