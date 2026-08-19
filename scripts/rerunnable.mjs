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
 * Statement forms that are safe to run twice, keyed by the leading verb.
 *
 * An ALLOWLIST, not a denylist. A list of known-bad shapes only ever covers what
 * someone thought of, which is the same failure this guard replaced -- absence
 * is not an error, just absence -- and it would wear the file's "safe to run
 * twice" header while it happened. Anything unrecognised is refused, so the
 * unknown case costs an author one line here instead of costing an operator a
 * broken second paste.
 *
 * Each entry maps a leading verb to the pattern its SAFE form must match, plus
 * the fix to suggest. `null` as a fix means there is no idempotent spelling and
 * the statement has to be guarded in the migration itself.
 */
const SAFE = [
  // Unconditionally re-runnable: same end state however many times they run.
  { verb: /^(?:ALTER\s+DEFAULT\s+PRIVILEGES)\b/i, safe: /.*/ },
  { verb: /^(?:GRANT|REVOKE)\b/i, safe: /.*/ },
  { verb: /^(?:ALTER\s+TABLE\s+.*\s+(?:ENABLE|DISABLE|FORCE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY)/i, safe: /.*/ },
  { verb: /^DO\b/i, safe: /.*/ }, // a DO block does its own catalog checks
  { verb: /^(?:SELECT|SET|COMMENT|ANALYZE|VACUUM)\b/i, safe: /.*/ },

  // Writes. INSERT does NOT belong in the bucket above: a seed row or a backfill
  // duplicates on a second paste, or aborts the transaction on a unique
  // constraint. It needs a conflict clause or an existence guard -- the same
  // spelling the generator already uses for its own _prisma_migrations row.
  {
    verb: /^INSERT\b/i,
    safe: /\bON\s+CONFLICT\b|\bWHERE\s+NOT\s+EXISTS\b/i,
    fix: 'INSERT ... ON CONFLICT DO NOTHING (or ... WHERE NOT EXISTS)',
  },
  // UPDATE and DELETE are re-runnable when the change is idempotent -- setting a
  // column to a literal or a function of the row's identity, deleting rows
  // matching a predicate. An UPDATE is NOT re-runnable when the new value is
  // derived from the old one (SET "n" = "n" + 1 climbs on every paste), which is
  // what a self-reference in the SET clause shows and a WHERE clause cannot.
  { verb: /^UPDATE\b/i, safe: noSelfReferencingAssignment, fix: null },
  { verb: /^DELETE\b/i, safe: /.*/ },
  { verb: /^CREATE\s+OR\s+REPLACE\b/i, safe: /.*/ },

  // Re-runnable only in their guarded spelling.
  { verb: /^CREATE\s+TABLE\b/i, safe: /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i, fix: 'CREATE TABLE IF NOT EXISTS' },
  { verb: /^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i, safe: /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?IF\s+NOT\s+EXISTS\b/i, fix: 'CREATE INDEX IF NOT EXISTS' },
  { verb: /^CREATE\s+SEQUENCE\b/i, safe: /^CREATE\s+SEQUENCE\s+IF\s+NOT\s+EXISTS\b/i, fix: 'CREATE SEQUENCE IF NOT EXISTS' },
  { verb: /^CREATE\s+SCHEMA\b/i, safe: /^CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\b/i, fix: 'CREATE SCHEMA IF NOT EXISTS' },
  { verb: /^CREATE\s+EXTENSION\b/i, safe: /^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\b/i, fix: 'CREATE EXTENSION IF NOT EXISTS' },
  { verb: /^DROP\s+TABLE\b/i, safe: /^DROP\s+TABLE\s+IF\s+EXISTS\b/i, fix: 'DROP TABLE IF EXISTS' },
  { verb: /^DROP\s+INDEX\b/i, safe: /^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?IF\s+EXISTS\b/i, fix: 'DROP INDEX IF EXISTS' },
  { verb: /^ALTER\s+TABLE\b/i, safe: null, sub: [
      { find: /\bADD\s+COLUMN\b/i, safe: /\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i, fix: 'ADD COLUMN IF NOT EXISTS' },
      { find: /\bDROP\s+COLUMN\b/i, safe: /\bDROP\s+COLUMN\s+IF\s+EXISTS\b/i, fix: 'DROP COLUMN IF EXISTS' },
      { find: /\bDROP\s+CONSTRAINT\b/i, safe: /\bDROP\s+CONSTRAINT\s+IF\s+EXISTS\b/i, fix: 'DROP CONSTRAINT IF EXISTS' },
      // ADD CONSTRAINT has no IF NOT EXISTS form in any supported Postgres.
      { find: /\bADD\s+CONSTRAINT\b/i, safe: null, fix: null },
    ] },
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
 *
 * Comments are stripped first, because the lockdown migrations discuss the very
 * statements being scanned for and a scanner that reads its own prose refuses a
 * migration that is fine. String literals are deliberately NOT stripped:
 * `EXECUTE format('CREATE TABLE ...')` collides on a second run exactly like the
 * bare statement, so it has to stay visible.
 * @param {string} name migration directory name, for the message
 * @param {string} sql the migration's SQL, after makeRerunnable
 */
export function assertRerunnable(name, sql) {
  for (const statement of statements(stripSqlComments(sql))) {
    const entry = SAFE.find((e) => e.verb.test(statement));
    if (!entry) {
      throw new Error(
        `${name}: ${JSON.stringify(preview(statement))} is a statement scripts/rerunnable.mjs ` +
          'does not know how to judge, and docs/supabase-lockdown.sql promises it is safe to run ' +
          'twice. Add it to SAFE with the pattern its re-runnable form must match.',
      );
    }
    const rules = entry.sub ?? [{ find: null, safe: entry.safe, fix: entry.fix }];
    const matched = rules.filter((rule) => !rule.find || rule.find.test(statement));
    if (entry.sub && matched.length === 0) {
      // The allowlist has to hold one level down too. Without this the verb
      // matched, no sub-rule did, and the statement was waved through -- so
      // ALTER INDEX ... RENAME was refused while ALTER TABLE ... RENAME TO,
      // RENAME COLUMN, RENAME CONSTRAINT and an unnamed ADD PRIMARY KEY all
      // sailed past, none of them re-runnable.
      throw new Error(
        `${name}: ${JSON.stringify(preview(statement))} uses an ALTER TABLE subcommand ` +
          'scripts/rerunnable.mjs does not know how to judge, and docs/supabase-lockdown.sql ' +
          'promises it is safe to run twice. Add it to the sub list in SAFE with the pattern ' +
          'its re-runnable form must match.',
      );
    }
    for (const rule of matched) {
      if (rule.safe && matches(rule.safe, statement)) continue;
      {
        throw new Error(
          `${name}: ${JSON.stringify(preview(statement))} aborts if ` +
            'docs/supabase-lockdown.sql is pasted twice, and that file promises it is safe to ' +
            'run twice. ' +
            (rule.fix
              ? `Add a rewrite to REWRITES in scripts/rerunnable.mjs turning it into "${rule.fix}".`
              : 'This statement has no idempotent form — guard it in the migration with a DO ' +
                'block that checks the catalog first.'),
        );
      }
    }
  }
}

/**
 * Splits SQL into statements on top-level semicolons, skipping the ones inside a
 * dollar-quoted body so a DO block stays one statement.
 * @param {string} sql
 * @returns {string[]}
 */
function statements(sql) {
  const out = [];
  let buf = '';
  for (let i = 0; i < sql.length; ) {
    // Single quoting as well as dollar quoting, matching the shared stripper. A
    // `;` inside a literal would otherwise split one statement into two, and the
    // tail fragment lands on a verb the allowlist does not know -- so it failed
    // closed rather than open, but on the wrong reason.
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      buf += sql.slice(i, Math.min(j + 1, sql.length));
      i = j + 1;
      continue;
    }
    const tag = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i))?.[0];
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length);
      const end = close === -1 ? sql.length : close + tag.length;
      buf += sql.slice(i, end);
      i = end;
    } else if (sql[i] === ';') {
      out.push(buf);
      buf = '';
      i += 1;
    } else {
      buf += sql[i];
      i += 1;
    }
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * A `safe` entry is either a pattern the statement must match or a predicate.
 * @param {RegExp | ((statement: string) => boolean)} safe
 * @param {string} statement
 */
function matches(safe, statement) {
  return typeof safe === 'function' ? safe(statement) : safe.test(statement);
}

/**
 * True when no assignment in the SET clause reads the column it writes.
 * `SET "n" = "n" + 1` climbs on every run; `SET "expiresAt" = now()` does not.
 * @param {string} statement
 */
function noSelfReferencingAssignment(statement) {
  const set = /\bSET\b([\s\S]*?)(?:\bWHERE\b|$)/i.exec(statement)?.[1] ?? '';
  for (const [, column, value] of set.matchAll(/"([^"]+)"\s*=\s*([^,]+)/g)) {
    if (new RegExp(`"${column.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}"`).test(value)) return false;
  }
  return true;
}

/** First line of a statement, for an error message that fits on a screen. */
function preview(statement) {
  const line = statement.split('\n')[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}
