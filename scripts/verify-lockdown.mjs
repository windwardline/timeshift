// Reports whether the public-schema lockdown is actually in force on the database
// DATABASE_URL points at. Read-only. Uses @prisma/client, which is already a
// dependency, so it needs no psql and no extra tooling.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let bad = 0;

try {
  // Checked against the same surface the migration revokes, not a narrower one.
  // SELECT alone would report "denied" for a role holding INSERT/UPDATE/DELETE --
  // PostgREST writes through those too -- and tables alone would miss views and
  // materialised views, which are their own exposure path: a view over "User" is
  // not covered by the base table's RLS unless it is security_invoker.
  const PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const anyPriv = (role) =>
    PRIVS.map((p) => `COALESCE(has_table_privilege('${role}', c.oid, '${p}'), false)`).join(' OR ');
  const tables = await prisma.$queryRawUnsafe(`
    SELECT c.relname::text AS table,
           CASE c.relkind WHEN 'r' THEN '' WHEN 'p' THEN ' (partitioned)'
                          WHEN 'v' THEN ' (view)' WHEN 'm' THEN ' (matview)'
                          WHEN 'f' THEN ' (foreign)' ELSE ' (sequence)' END AS kind,
           -- RLS is meaningless on a view or sequence; report it as n/a rather
           -- than as a failure, so the summary is not noisy about the wrong thing.
           (c.relkind IN ('r','p')) AS rls_applies,
           c.relrowsecurity AS rls,
           (${anyPriv('anon')}) AS anon_any,
           (${anyPriv('authenticated')}) AS auth_any
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f','S')
    ORDER BY 1
  `);

  console.log('object                    RLS    anon      authenticated');
  console.log('------------------------- ------ --------- -------------');
  for (const t of tables) {
    const rlsOk = t.rls_applies ? t.rls : true;
    const ok = rlsOk && !t.anon_any && !t.auth_any;
    if (!ok) bad += 1;
    console.log(
      `${(t.table + t.kind).padEnd(25)} ` +
        `${(t.rls_applies ? (t.rls ? 'on' : 'OFF') : 'n/a').padEnd(6)} ` +
        `${(t.anon_any ? 'CAN USE!' : 'denied').padEnd(9)} ` +
        `${(t.auth_any ? 'CAN USE!' : 'denied').padEnd(13)}${ok ? '' : '  <-- NOT LOCKED DOWN'}`,
    );
  }

  // The half of the migration that regresses silently: if the default privileges
  // are re-granted, the NEXT table a migration creates is exposed again, and
  // nothing about today's tables would show it.
  const defaults = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(string_agg(DISTINCT r.rolname, ', '), '') AS roles
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    JOIN pg_roles r ON r.oid = a.grantee
    WHERE n.nspname = 'public' AND r.rolname IN ('anon', 'authenticated')
  `);
  const leaked = defaults[0].roles;
  if (leaked) bad += 1;
  console.log(
    `\ndefault privileges for future tables: ${leaked ? `GRANTED TO ${leaked} <-- next table will be exposed` : 'revoked'}`,
  );

  // A database that has never been migrated has no _prisma_migrations table at
  // all. That is a legitimate state to report -- "nothing applied yet" -- not an
  // error to throw, since --verify-only is the natural way to check before acting.
  const hasHistory = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
  );
  const applied = hasHistory[0].present
    ? await prisma.$queryRawUnsafe(
        `SELECT migration_name::text AS name FROM "_prisma_migrations"
         WHERE finished_at IS NOT NULL ORDER BY started_at`,
      )
    : [];
  const names = applied.map((r) => r.name);
  console.log('\nmigrations applied:');
  for (const want of ['lock_down_public_schema', 'add_rate_limit', 'drop_dead_password_hash']) {
    const hit = names.find((n) => n.includes(want));
    if (!hit) bad += 1;
    console.log(`  ${hit ? 'yes' : 'NO '}  ${want}`);
  }

  const cols = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_name = 'User' AND column_name = 'passwordHash'`,
  );
  const userExists = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."User"') IS NOT NULL AS present`,
  );
  if (!userExists[0].present) {
    console.log('\ndead passwordHash column: n/a (User table not created yet)');
  } else {
    const dropped = cols[0].n === 0;
    if (!dropped) bad += 1;
    console.log(`\ndead passwordHash column: ${dropped ? 'dropped' : 'STILL PRESENT'}`);
  }

  console.log(bad === 0 ? '\nRESULT: locked down.' : `\nRESULT: ${bad} problem(s) above.`);
} catch (error) {
  console.error('\nCould not verify:', error instanceof Error ? error.message : error);
  bad = 1;
} finally {
  await prisma.$disconnect();
}
process.exit(bad === 0 ? 0 : 1);
