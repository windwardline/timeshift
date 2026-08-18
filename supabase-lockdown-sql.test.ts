import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
    .filter((n) => n >= '20260818204500');
}

describe('docs/supabase-lockdown.sql', () => {
  it('is exactly what the generator produces from the current migrations', () => {
    const committed = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    // The generator writes the file; regenerate into place and compare, then the
    // working tree is left as it was if they already matched.
    execFileSync('node', ['scripts/generate-supabase-sql.mjs'], { cwd: root });
    const regenerated = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    expect(
      regenerated,
      'docs/supabase-lockdown.sql is stale or hand-edited — run `node scripts/generate-supabase-sql.mjs`',
    ).toBe(committed);
  });

  it('carries every migration from the lockdown onward', () => {
    // The failure this is really guarding: a migration that exists but is missing
    // from the file, so the browser path silently skips it.
    const sql = readFileSync(join(root, 'docs/supabase-lockdown.sql'), 'utf8');
    const expected = readFileSync(join(root, 'scripts/generate-supabase-sql.mjs'), 'utf8').includes(
      "name >= '20260818204500'",
    );
    expect(expected, 'generator no longer derives its migration list by date').toBe(true);

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
