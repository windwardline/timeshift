// Reports whether the public-schema lockdown is actually in force on the database
// DATABASE_URL points at. Read-only. Uses @prisma/client, which is already a
// dependency, so it needs no psql and no extra tooling.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let bad = 0;

try {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT c.relname::text AS table,
           c.relrowsecurity AS rls,
           COALESCE(has_table_privilege('anon',          c.oid, 'SELECT'), false) AS anon_select,
           COALESCE(has_table_privilege('authenticated', c.oid, 'SELECT'), false) AS auth_select
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1
  `);

  console.log('table                     RLS    anon    authenticated');
  console.log('------------------------- ------ ------- -------------');
  for (const t of tables) {
    const ok = t.rls && !t.anon_select && !t.auth_select;
    if (!ok) bad += 1;
    console.log(
      `${t.table.padEnd(25)} ${(t.rls ? 'on' : 'OFF').padEnd(6)} ` +
        `${(t.anon_select ? 'READS!' : 'denied').padEnd(7)} ` +
        `${(t.auth_select ? 'READS!' : 'denied').padEnd(13)}${ok ? '' : '  <-- NOT LOCKED DOWN'}`,
    );
  }

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
