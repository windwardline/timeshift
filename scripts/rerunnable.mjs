// Keeps the paste file's "safe to run twice" promise honest.
//
// docs/supabase-lockdown.sql is one transaction that an operator may paste more
// than once -- after a partial failure, or just to re-check a project. Prisma
// migrations are not written for that: `migrate deploy` guarantees once-only
// application, so generated DDL collides on a second run.
//
// Two halves. `makeRerunnable` applies the known rewrites. `assertRerunnable`
// is the backstop for everything else: the rewrite map is keyed by migration
// name, so it can only ever cover migrations someone thought about, and
// scripts/lockdown-migrations.mjs now pulls new migrations in automatically. A
// new one would otherwise be copied in verbatim under a header promising it is
// re-runnable, and the promise would break on somebody else's second paste.
//
// Refusing to emit is the right failure. Some DDL has no idempotent form at all
// (ADD CONSTRAINT), so this cannot rewrite its way out -- it has to make the
// author decide.
import { stripSqlComments } from './sql-text.mjs';

/** (needle -> replacement) per migration. Applied strictly; see makeRerunnable. */
const REWRITES = {
  '20260818211531_add_rate_limit': [
    ['CREATE TABLE "RateLimit"', 'CREATE TABLE IF NOT EXISTS "RateLimit"'],
    ['CREATE INDEX "RateLimit_expiresAt_idx"', 'CREATE INDEX IF NOT EXISTS "RateLimit_expiresAt_idx"'],
  ],
  '20260818212336_drop_dead_password_hash': [
    ['DROP COLUMN "passwordHash"', 'DROP COLUMN IF EXISTS "passwordHash"'],
  ],
};

/**
 * Statements that abort a second run, and what to do about each. `null` means
 * there is no idempotent spelling -- the migration has to be rewritten or the
 * statement wrapped in a DO block that checks the catalog first.
 */
const COLLIDES = [
  [/\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS'],
  [/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS|CONCURRENTLY\s+IF\s+NOT\s+EXISTS)/i, 'CREATE INDEX IF NOT EXISTS'],
  [/\bCREATE\s+SEQUENCE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE SEQUENCE IF NOT EXISTS'],
  [/\bCREATE\s+SCHEMA\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE SCHEMA IF NOT EXISTS'],
  [/\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/i, 'ADD COLUMN IF NOT EXISTS'],
  [/\bDROP\s+COLUMN\s+(?!IF\s+EXISTS)/i, 'DROP COLUMN IF EXISTS'],
  [/\bDROP\s+TABLE\s+(?!IF\s+EXISTS)/i, 'DROP TABLE IF EXISTS'],
  [/\bADD\s+CONSTRAINT\b/i, null],
  [/\bCREATE\s+TYPE\b/i, null],
];

/**
 * Applies the known rewrites for one migration.
 * A declared needle that no longer matches throws rather than no-opping: a
 * silent miss costs the file its safe-to-run-twice property, and the failure
 * only shows up as an aborted transaction on someone else's second paste.
 * @param {string} name migration directory name
 * @param {string} sql the migration's SQL
 * @returns {string} the rewritten SQL
 */
export function makeRerunnable(name, sql) {
  let out = sql;
  for (const [needle, replacement] of REWRITES[name] ?? []) {
    if (!out.includes(needle)) {
      throw new Error(
        `${name}: expected to make ${JSON.stringify(needle)} re-runnable, but it is not in the ` +
          'migration any more. Update REWRITES rather than shipping a file that aborts on a second run.',
      );
    }
    out = out.replace(needle, replacement);
  }
  return out;
}

/**
 * Throws if `sql` still holds DDL that would abort a second paste.
 * Comments and string literals are stripped first: the lockdown migrations
 * discuss the very statements being scanned for, and a scanner that reads its
 * own prose refuses a migration that is fine.
 * @param {string} name migration directory name, for the message
 * @param {string} sql the migration's SQL, after makeRerunnable
 */
export function assertRerunnable(name, sql) {
  const code = stripSqlComments(sql);
  for (const [pattern, fix] of COLLIDES) {
    const hit = pattern.exec(code);
    if (!hit) continue;
    throw new Error(
      `${name}: ${JSON.stringify(hit[0].trim())} aborts if docs/supabase-lockdown.sql is pasted ` +
        'twice, and that file promises it is safe to run twice. ' +
        (fix
          ? `Add a rewrite to REWRITES in scripts/rerunnable.mjs turning it into "${fix}".`
          : 'This statement has no idempotent form — guard it in the migration with a DO block ' +
            'that checks the catalog first, or exclude it deliberately.'),
    );
  }
}
