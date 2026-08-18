import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCKDOWN_FLOOR } from './scripts/lockdown-migrations.mjs';

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
    // The gate above must not be able to fix its own failure. Corrupt the file,
    // run the suite's generator invocation, and the corruption must survive --
    // if it does not, the test is self-healing again.
    const path = join(root, 'docs/supabase-lockdown.sql');
    const original = readFileSync(path, 'utf8');
    try {
      writeFileSync(path, '-- drifted\n');
      const out = join(mkdtempSync(join(tmpdir(), 'lockdown-sql-')), 'generated.sql');
      execFileSync('node', ['scripts/generate-supabase-sql.mjs', '--out', out], { cwd: root });
      expect(readFileSync(path, 'utf8'), 'the generator overwrote the committed file').toBe(
        '-- drifted\n',
      );
    } finally {
      writeFileSync(path, original);
    }
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
