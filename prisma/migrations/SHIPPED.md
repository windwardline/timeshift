# shipped.sha256

Pins the SHA-256 of **every** migration directory under `prisma/migrations` — not
only the five `docs/supabase-lockdown.sql` carries.

Written in `sha256sum`'s own format, so `sha256sum -c shipped.sha256` verifies it
from this directory with no bespoke tooling. It is deliberately not JSON: a
`"name": "<64 hex>"` pair reads as a key assignment to gitleaks' generic API-key
rule, which failed the secret scan on a public checksum.

Prisma records a migration's checksum in `_prisma_migrations` when it applies it,
so every migration this repo has ever shipped is pinned by both live databases —
the sprint's five through `migrate deploy`, the lockdown's five through that or
through the browser path, which writes the same checksums.

Editing a shipped migration — even only its comments — changes its checksum, and
the next `prisma migrate deploy` then fails on mismatch against a database that
is in fact correct.

Not on a deploy, though — and that is the point. `build` is `next build`,
`postinstall` is `prisma generate`, and `vercel.json` carries only headers, so
nothing in a deploy runs `migrate deploy` or reads `_prisma_migrations`
(AGENTS.md §5 says the same). The mismatch surfaces the next time a person runs
`./scripts/secure-database.sh` against production or preview: at the
`migrate deploy` step, before verification and before credential rotation. A
worse moment to discover it than a red build, which is why this is pinned rather
than left to a deploy to catch.

The drift test cannot catch it: regenerating the paste file updates the recorded
checksum in lockstep with the file, so the two move together and agree. This pin
sits outside the generator's reach, and `supabase-lockdown-sql.test.ts` fails CI
when a pinned file changes.

**Adding a new migration is always fine** — add its entry here in the same
commit. **Editing an existing one is not.** Write another migration instead.
