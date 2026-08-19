# shipped.lock.json

Pins the SHA-256 of every migration `docs/supabase-lockdown.sql` carries.

Those checksums are written into `_prisma_migrations` on any database fixed
through the browser path. Editing a shipped migration — even only its comments —
changes its checksum, and the next `prisma migrate deploy` then fails on mismatch
against a database that is in fact correct. That includes every Vercel build.

The drift test cannot catch it: regenerating the paste file updates the recorded
checksum in lockstep with the file, so the two move together and agree. This pin
sits outside the generator's reach, and `supabase-lockdown-sql.test.ts` fails CI
when a pinned file changes.

**Adding a new migration is always fine** — add its entry here in the same
commit. **Editing an existing one is not.** Write another migration instead.
