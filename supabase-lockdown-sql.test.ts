import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCKDOWN_FLOOR } from './scripts/lockdown-migrations.mjs';
import { assertRerunnable, makeRerunnable } from './scripts/rerunnable.mjs';

// docs/supabase-lockdown.sql is generated, committed, and used to secure a live
// database by hand. Nothing else checks it: security-rls.test.ts reads
// prisma/migrations and knows nothing about this file, so a new model could ship
// with its RLS line present in the migration -- CI green -- and absent from the
// file, leaving anyone who used the browser path with the new table published.
//
// "Never edit it by hand" in the README is the honour system that
// security-rls.test.ts exists to replace. This is the check instead.

const root = process.cwd();

/** The migrations the paste file is responsible for — the lockdown onward. */
function shippedMigrations(): string[] {
  return readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => n >= LOCKDOWN_FLOOR);
}

describe('rerunnable guard', () => {
  // The generated file promises "safe to run twice". That promise was only ever
  // enforced for the two migrations named in the generator's rewrite map: a NEW
  // migration is copied in verbatim, and the map's throw never fires for a needle
  // that was never declared. So the next model someone adds ships a
  // `CREATE TABLE "Foo"` under a header that says the file is re-runnable, and
  // the operator's second paste aborts with `relation "Foo" already exists` on a
  // project that is in fact already secured.
  it('accepts DDL that is guarded', () => {
    expect(() =>
      assertRerunnable('m', 'CREATE TABLE IF NOT EXISTS "Foo" (id text);'),
    ).not.toThrow();
    expect(() =>
      assertRerunnable('m', 'ALTER TABLE "User" DROP COLUMN IF EXISTS "x";'),
    ).not.toThrow();
    expect(() => assertRerunnable('m', 'CREATE INDEX IF NOT EXISTS i ON "Foo"(id);')).not.toThrow();
  });

  it('refuses DDL that collides on a second run', () => {
    for (const ddl of [
      'CREATE TABLE "Foo" (id text);',
      'CREATE UNIQUE INDEX "Foo_id_key" ON "Foo"(id);',
      'ALTER TABLE "Foo" ADD COLUMN "b" text;',
      'ALTER TABLE "Foo" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "Bar"("id");',
      'CREATE TYPE "Mood" AS ENUM (\'ok\');',
      'ALTER TABLE "Foo" DROP COLUMN "b";',
      // Stock `prisma migrate dev` output, not exotica: these two are what
      // removing an @@index and removing a relation produce.
      'DROP INDEX "Foo_bar_idx";',
      'ALTER TABLE "Foo" DROP CONSTRAINT "Foo_barId_fkey";',
      // And the rest of what this schema could plausibly grow into.
      "ALTER TYPE \"Mood\" ADD VALUE 'meh';",
      'CREATE POLICY "p" ON "Foo" USING (true);',
      'CREATE TRIGGER "t" BEFORE INSERT ON "Foo" EXECUTE FUNCTION f();',
      'CREATE EXTENSION pgcrypto;',
    ]) {
      expect(() => assertRerunnable('20990101_x', ddl), ddl).toThrow(/20990101_x/);
    }
  });

  it('refuses a data INSERT that has no conflict clause', () => {
    // INSERT sat in the "unconditionally re-runnable" bucket, which it does not
    // belong in: a seed row or a backfill in a future migration would ship into
    // the paste file under its safe-to-run-twice header and, on a second paste,
    // either duplicate the row or abort the whole transaction on a unique
    // constraint -- the wall-of-ERROR-on-an-already-secured-project failure this
    // guard exists to prevent. The generator's own _prisma_migrations INSERT is
    // written as INSERT ... SELECT ... WHERE NOT EXISTS, so the knowledge existed;
    // it just lived in a string template rather than in the guard.
    expect(() => assertRerunnable('20990101_x', `INSERT INTO "Setting" VALUES ('a','b');`)).toThrow(
      /20990101_x/,
    );
    expect(() =>
      assertRerunnable('20990101_x', `UPDATE "Counter" SET "n" = "n" + 1;`),
    ).toThrow(/20990101_x/);
    for (const ok of [
      `INSERT INTO "Setting" VALUES ('a','b') ON CONFLICT DO NOTHING;`,
      `INSERT INTO "Setting" VALUES ('a','b') ON CONFLICT ("key") DO UPDATE SET "value" = 'b';`,
      `INSERT INTO "Setting" SELECT 'a','b' WHERE NOT EXISTS (SELECT 1 FROM "Setting");`,
      `UPDATE "Session" SET "expiresAt" = now() WHERE "expiresAt" > now();`,
    ]) {
      expect(() => assertRerunnable('m', ok), ok).not.toThrow();
    }
  });

  it('fails closed when it cannot decompose a SET clause', () => {
    // The self-reference check exists for SET "n" = "n" + 1. Three ways past it,
    // all silent accepts under a header that says anything unrecognised is
    // refused -- the same denylist-wearing-an-allowlist's-header shape this
    // module has now been bitten by at the verb level and inside ALTER TABLE.
    for (const ddl of [
      // The clause it was written for, on the statement where it actually turns
      // up: INSERT matches first, so the predicate never ran.
      `INSERT INTO "T" VALUES (1) ON CONFLICT ("k") DO UPDATE SET "n" = "T"."n" + 1;`,
      // Unquoted identifiers produce zero matches, and zero matches read as safe.
      `UPDATE "T" SET n = n + 1;`,
      // A subquery's WHERE truncates the SET clause, hiding later assignments.
      `UPDATE "T" SET "a" = (SELECT 1 FROM "U" WHERE "U"."id" = 1), "n" = "n" + 1;`,
    ]) {
      expect(() => assertRerunnable('20990101_x', ddl), ddl).toThrow(/20990101_x/);
    }
    // And the honest spellings still pass.
    for (const ok of [
      `INSERT INTO "T" VALUES (1) ON CONFLICT ("k") DO UPDATE SET "n" = 0;`,
      `INSERT INTO "T" VALUES (1) ON CONFLICT DO NOTHING;`,
      `UPDATE "Session" SET "expiresAt" = now() WHERE "expiresAt" > now();`,
    ]) {
      expect(() => assertRerunnable('m', ok), ok).not.toThrow();
    }
  });

  it('reads a SET clause by paren depth, not by the first comma or keyword', () => {
    // The first attempt at this check split assignments on any comma and cut the
    // clause at any FROM. Both appear INSIDE value expressions, so the plainest
    // self-reference hid behind either one -- the same truncation the check was
    // written to close, one level down. Regex cannot parse SQL expressions;
    // tracking parenthesis depth can.
    for (const ddl of [
      // A comma inside a call ended the scan, and the increment sat past it.
      `UPDATE "T" SET "n" = least(100, "n" + 1);`,
      // FROM is part of extract()/substring()/trim(), not only a clause terminator.
      `UPDATE "T" SET "a" = extract(epoch FROM "ts"), "n" = "n" + 1;`,
      // Postgres allows $ in identifiers, and an unescaped $ in the built pattern
      // is an end-of-input anchor -- so the reference could never match.
      `UPDATE "T" SET "n$x" = "n$x" + 1;`,
    ]) {
      expect(() => assertRerunnable('20990101_x', ddl), ddl).toThrow(/20990101_x/);
    }
  });

  it('never reads the inside of a literal as structure', () => {
    // Third time this class of bug appeared: WHERE, then FROM, now the contents
    // of a dollar quote. Each earlier fix taught the scanner one more keyword
    // instead of stopping it from reading literals at all. Literal contents are
    // now masked before anything is scanned, so no keyword, comma, paren or
    // bracket inside one can be mistaken for structure.
    for (const ddl of [
      `UPDATE "T" SET "a" = $$ WHERE $$, "n" = "n" + 1;`,
      `UPDATE "T" SET "a" = $$ ) $$, "n" = "n" + 1;`,
      `UPDATE "T" SET "a" = ' WHERE ', "n" = "n" + 1;`,
      `UPDATE "T" SET "a" = ARRAY[1,2], "n" = "n" + 1;`,
    ]) {
      expect(() => assertRerunnable('20990101_x', ddl), ddl).toThrow(/20990101_x/);
    }
  });

  it('accepts statements it previously refused only because it could not parse them', () => {
    // These are all re-runnable. Refusing them was fail-closed, so not a
    // soundness problem, but the error named a remedy -- wrap it in a DO block --
    // that does not apply to a statement which is already fine.
    for (const ok of [
      // The word SET inside a literal is not the start of a SET clause.
      `INSERT INTO "Log" ("msg") VALUES ('please SET the flag') ON CONFLICT ("k") DO UPDATE SET "msg" = EXCLUDED."msg";`,
      // Multi-column assignment.
      `UPDATE "T" SET ("a","b") = (1, 2);`,
      // A bracketed array is one value, not two assignments.
      `UPDATE "T" SET "a" = ARRAY[1,2];`,
    ]) {
      expect(() => assertRerunnable('m', ok), ok).not.toThrow();
    }
    // and the multi-column form still catches a self-reference
    expect(() => assertRerunnable('20990101_x', `UPDATE "T" SET ("a","n") = (1, "n" + 1);`)).toThrow(
      /20990101_x/,
    );
  });

  it('accepts the canonical upsert, which reads EXCLUDED rather than the row', () => {
    // SET x = EXCLUDED.x is the standard spelling and is perfectly re-runnable:
    // EXCLUDED is the proposed row, not the stored one. Refusing it sent authors
    // to ON CONFLICT DO NOTHING, which is a different statement, not a rewrite.
    for (const ok of [
      `INSERT INTO "T" VALUES (1) ON CONFLICT ("k") DO UPDATE SET "a" = EXCLUDED."a";`,
      `INSERT INTO "T" VALUES (1) ON CONFLICT ("k") DO UPDATE SET "a" = excluded.a;`,
    ]) {
      expect(() => assertRerunnable('m', ok), ok).not.toThrow();
    }
    // But EXCLUDED does not launder a real self-reference sitting beside it.
    expect(() =>
      assertRerunnable(
        '20990101_x',
        `INSERT INTO "T" VALUES (1) ON CONFLICT ("k") DO UPDATE SET "a" = EXCLUDED."a", "n" = "n" + 1;`,
      ),
    ).toThrow(/20990101_x/);
  });

  it('fails closed inside ALTER TABLE too, not just at the leading verb', () => {
    // The allowlist held at the verb -- ALTER INDEX ... RENAME was refused --
    // but ALTER TABLE carries sub-rules that each skip when their pattern does
    // not match, so an unlisted subcommand fell off the end and was accepted.
    // None of these survive a second run, and all are one schema edit away.
    for (const ddl of [
      'ALTER TABLE "Foo" RENAME TO "Bar";',
      'ALTER TABLE "Foo" RENAME COLUMN "a" TO "b";',
      'ALTER TABLE "Foo" RENAME CONSTRAINT "c1" TO "c2";',
      'ALTER TABLE "Foo" ADD PRIMARY KEY ("id");',
    ]) {
      expect(() => assertRerunnable('20990101_x', ddl), ddl).toThrow(/20990101_x/);
    }
  });

  it('fails closed: refuses a statement it has never heard of', () => {
    // The point of inverting the denylist. A guard that only knows the shapes
    // someone thought of has the same failure as the hardcoded migration list it
    // replaced -- absence is not an error, just absence -- and it would be
    // wearing the file's "safe to run twice" header while it happened.
    expect(() => assertRerunnable('20990101_x', 'CLUSTER "Foo" USING "Foo_pkey";')).toThrow(
      /20990101_x/,
    );
    expect(() => assertRerunnable('20990101_x', 'REINDEX TABLE "Foo";')).toThrow(/20990101_x/);
  });

  it('does not trip on DDL that only appears in a comment', () => {
    // The lockdown migrations are heavily commented and discuss the very
    // statements being scanned for; a scanner that reads its own prose refuses
    // a migration that is fine.
    expect(() =>
      assertRerunnable('m', `-- CREATE TABLE "Foo" (id text);\nSELECT 1;`),
    ).not.toThrow();
  });

  it('still sees DDL inside a string literal, because EXECUTE runs it', () => {
    // Deliberately NOT exempted. A literal is how dynamic DDL is written --
    // EXECUTE format('CREATE TABLE ...') collides on a second run exactly like
    // the bare statement does. Scanning it costs a false positive on a literal
    // that is never executed, which is the cheaper mistake: a false positive
    // makes an author think, a false negative ships the broken promise.
    expect(() => assertRerunnable('m', `EXECUTE format('CREATE TABLE \"Foo\" (id text)');`)).toThrow();
  });

  it('passes every migration the paste file actually ships', () => {
    for (const name of shippedMigrations()) {
      const sql = readFileSync(join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
      // Scanned after the generator's rewrites, which is where the guards are added.
      expect(() => assertRerunnable(name, makeRerunnable(name, sql)), name).not.toThrow();
    }
  });
});

describe('docs/supabase-lockdown.sql', () => {
  it('is exactly what the generator produces from the current migrations', () => {
    // Generated to a temp path, never over the committed file. Regenerating in
    // place makes this gate fire exactly once: the failing run leaves the fresh
    // content on disk, the rerun a developer reflexively does reads that back as
    // "committed" and passes, and a tracked security artifact has been rewritten
    // by a test run with nothing on screen to say so.
    const out = join(mkdtempSync(join(tmpdir(), 'lockdown-sql-')), 'generated.sql');
    execFileSync('node', ['scripts/generate-supabase-sql.mjs', '--out', out], { cwd: root });
    const committed = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    expect(
      readFileSync(out, 'utf8'),
      'docs/supabase-lockdown.sql is stale or hand-edited — run `node scripts/generate-supabase-sql.mjs`',
    ).toBe(committed);
  });

  it('leaves the committed file untouched when it runs', () => {
    // The gate above must not be able to fix its own failure, so --out has to
    // write somewhere else. Established by watching the file's identity rather
    // than by corrupting it and restoring in a finally: a finally does not run
    // on SIGINT or a killed worker, and the cost of losing that race is a
    // committed security artifact replaced by a stub that `git commit -am`
    // sweeps up. mtime and inode both move on a rewrite even when the bytes
    // would have been identical, which a content comparison would miss.
    const path = join(root, 'docs/supabase-lockdown.sql');
    const before = statSync(path);
    const out = join(mkdtempSync(join(tmpdir(), 'lockdown-sql-')), 'generated.sql');
    execFileSync('node', ['scripts/generate-supabase-sql.mjs', '--out', out], { cwd: root });
    const after = statSync(path);
    expect(after.mtimeMs, 'the generator rewrote the committed file').toBe(before.mtimeMs);
    expect(after.ino, 'the generator replaced the committed file').toBe(before.ino);
  });

  it('carries every migration from the lockdown onward', () => {
    // The failure this is really guarding: a migration that exists but is missing
    // from the file, so the browser path silently skips it.
    const sql = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    const derived = readFileSync(join(root, 'scripts/lockdown-migrations.mjs'), 'utf8').includes(
      "name >= LOCKDOWN_FLOOR",
    );
    expect(derived, 'the shared list no longer derives its migrations by date').toBe(true);

    const shipped = shippedMigrations();
    expect(shipped.length).toBeGreaterThan(0);
    for (const name of shipped) expect(sql, `${name} missing from the paste file`).toContain(name);
  });

  it('never changes a migration that has already been applied somewhere', () => {
    // The checksums in this file are recorded into `_prisma_migrations` on every
    // database that took the browser path. Edit a shipped migration -- even just
    // its comments -- and the recorded checksum no longer matches the file, so
    // the next `prisma migrate deploy` fails on mismatch against a database that
    // is actually correct. Not on a deploy -- nothing in the build runs
    // migrate deploy -- but the next time someone runs scripts/secure-database.sh
    // against production or preview, before verification and before rotation.
    // prisma/migrations/SHIPPED.md carries the full reasoning.
    //
    // The drift test above cannot catch this: regenerating updates the recorded
    // checksum in lockstep with the file, so both move together and agree. Only
    // a pin outside the generator's reach notices. Adding a NEW migration is
    // always fine; this is about editing an old one.
    // Stored in sha256sum's own format ("<hash>  <path>"), so it verifies with
    // `sha256sum -c shipped.sha256` and needs no bespoke tooling. Not JSON: a
    // "name": "<64 hex>" pair reads as a key assignment to gitleaks' generic
    // API-key rule, which failed the secret scan on a public checksum.
    const pinned = new Map(
      readFileSync(join(root, 'prisma/migrations/shipped.sha256'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [checksum, path] = line.split(/\s+/);
          return [path.replace('/migration.sql', ''), checksum];
        }),
    );
    // Every migration directory, not just the ones the paste file carries. The
    // pin's subject is "has been applied to a database somewhere", which is true
    // of all ten: the five from the sprint are in _prisma_migrations on both
    // projects exactly as the lockdown five are, and editing one breaks the same
    // way. Scoping this to LOCKDOWN_FLOOR was inherited from the paste file's
    // needs, which is the right list for the drift test and the wrong one here.
    const everyMigration = readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const name of everyMigration) {
      expect([...pinned.keys()], `${name} missing from shipped.sha256`).toContain(name);
    }
    for (const [name, checksum] of pinned) {
      const raw = readFileSync(join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
      expect(
        createHash('sha256').update(raw).digest('hex'),
        `${name} has been edited since it shipped — add a new migration instead`,
      ).toBe(checksum);
    }

  });

  it('records each migration under the checksum Prisma computes', () => {
    // A wrong checksum makes the next `prisma migrate deploy` fail on mismatch,
    // which would strand the CLI against a database that is actually correct.
    const sql = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    for (const name of shippedMigrations()) {
      const raw = readFileSync(join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
      expect(sql, `${name} checksum`).toContain(createHash('sha256').update(raw).digest('hex'));
    }
  });

  it('stays re-runnable: every statement that could collide is guarded', () => {
    const sql = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "RateLimit"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "passwordHash"');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it('fails with one legible sentence on a project that was never migrated', () => {
    // The file carries the lockdown migrations, not the schema they alter. On a
    // project without it the first ALTER TABLE aborts the transaction and every
    // later statement echoes "current transaction is aborted" -- nothing is
    // applied, which is correct, but the reason is buried in the cascade.
    const sql = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    const fromBegin = sql.slice(sql.indexOf('BEGIN;'));
    // Up to the first statement that changes anything, not the first mention of
    // one -- the comment above the guard names ALTER TABLE too.
    const firstChange = fromBegin.search(/^ALTER TABLE "/m);
    expect(firstChange).toBeGreaterThan(0);
    const preflight = fromBegin.slice(0, firstChange);
    expect(preflight, 'no precondition check before the first schema change').toContain(
      `to_regclass('public."User"') IS NULL`,
    );
    expect(preflight).toMatch(/RAISE\s+EXCEPTION/i);
    expect(preflight, 'the message must say nothing was changed').toContain(
      'Nothing has been changed.',
    );
  });

  it('ends with a single verification statement', () => {
    // Supabase's SQL Editor renders only the LAST statement's result grid. Split
    // the verification across two queries and the operator sees the second one
    // alone -- which is how a green lockdown got read as a live exposure. One
    // statement after COMMIT means the grid on screen is the whole verdict.
    const sql = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    const after = sql.slice(sql.lastIndexOf('COMMIT;') + 'COMMIT;'.length);
    const statements = after
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .split(';')
      .filter((s) => s.trim().length > 0);
    expect(statements, 'the editor would show only the last of these').toHaveLength(1);
    expect(after, 'the verdict column is what the operator reads').toContain('AS verdict');
  });
});
