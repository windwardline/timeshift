import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Supabase publishes every table in the `public` schema through PostgREST and
// grants the `anon` role (the one behind a project's publishable key) access to
// each new table Prisma creates. Prisma models neither RLS nor grants, so the
// lockdown lives in a hand-written migration -- and nothing in `npm run build`
// would notice if it were dropped, or if a new model shipped uncovered.
//
// This test keeps that contract in the repo, the same way security-headers.test.ts
// keeps the header contract: a new model without its RLS line fails CI, not a
// Supabase advisory email.
//
// Known limit, so nobody over-trusts it: this matches text across the whole
// migration set, so a later migration that DROPs and re-CREATEs a modelled table
// still passes -- the original ENABLE line remains in the concatenation while the
// recreated table has RLS off. The lockdown's second layer covers that case (the
// ALTER DEFAULT PRIVILEGES revoke is persistent server state, so the recreated
// table gets no anon grant), but the diff would be down to one layer. Only a live
// check against the database itself could catch it here.

const root = process.cwd();

// The RLS statement has to name the TABLE, which is the model name only until a
// model carries `@@map`. Keying the guard off the model name would then demand a
// line that does not match the table -- and the line that satisfied it,
// `ALTER TABLE "<Model>"`, would abort `prisma migrate deploy` with
// `relation "<Model>" does not exist` against a live database. Resolve the map.
function tableNames(): string[] {
  const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
  return [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(
    ([, name, body]) => body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name,
  );
}

// Every assertion runs on the migrations with comments removed, because the
// lockdown migration discusses `anon`, `GRANT` and `PUBLIC` at length in its own
// prose: matching raw text would let a comment satisfy a positive check (deleting
// the DO block while keeping its comments must not pass) and let prose fail a
// negative one ("we no longer grant SELECT on this table to anon" is English, not
// a re-grant).
//
// The stripper is quote-aware rather than a regex, and that is the load-bearing
// part. A regex stripper treats the `--` inside `'a--b'` as a comment and blanks
// the rest of that line -- which would hide a real re-GRANT sitting after it and
// leave the guard silently green. Tracking string literals is what makes removing
// comments safe enough to be the single source for both directions.
/** Remove SQL comments, leaving anything inside a string literal untouched. */
function stripSqlComments(sql: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < sql.length; ) {
    const c = sql[i];
    const next = sql[i + 1];
    if (inString) {
      out += c;
      if (c === "'") {
        if (next === "'") {
          out += next; // '' is an escaped quote, not the end of the literal
          i += 2;
          continue;
        }
        inString = false;
      }
      i += 1;
    } else if (c === "'") {
      inString = true;
      out += c;
      i += 1;
    } else if (c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1; // to end of line
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i += 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

function migrationSql(): string {
  const dir = join(root, 'prisma/migrations');
  const raw = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => readFileSync(join(dir, e.name, 'migration.sql'), 'utf8'))
    .join('\n');
  return stripSqlComments(raw);
}

describe('public-schema lockdown (prisma/migrations)', () => {
  it('enables row-level security on every modelled table', () => {
    const sql = migrationSql();
    const models = tableNames();
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(
        sql,
        `${model} has no "ALTER TABLE \\"${model}\\" ENABLE ROW LEVEL SECURITY" — ` +
          'a table without it is readable by anyone holding the Supabase publishable key',
      ).toContain(`ALTER TABLE "${model}" ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('revokes the PostgREST grants anon and authenticated ride on', () => {
    const sql = migrationSql();
    // Matched on the contract -- both roles named, table grants revoked -- not on
    // the DO block's formatting, so a whitespace rewrite does not go red.
    for (const role of ['anon', 'authenticated']) expect(sql).toContain(role);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+(?:ALL\s+TABLES\s+IN\s+SCHEMA\s+public|TABLE)/i);
  });

  it('revokes default privileges so a future table is not auto-granted', () => {
    // Without this, the next `prisma migrate` silently hands `anon` a fresh
    // publicly-readable table -- the exact regression this suite exists to stop.
    expect(migrationSql()).toMatch(
      /ALTER\s+DEFAULT\s+PRIVILEGES\s+IN\s+SCHEMA\s+public\s+REVOKE\s+ALL\s+ON\s+TABLES/i,
    );
  });

  it('never turns the lockdown back off in a later migration', () => {

    // The checks above concatenate every migration and match on presence, so on
    // their own they are append-only: a later migration that DISABLEs RLS or
    // re-GRANTs to anon leaves the original ENABLE text in place and stays green.
    // This is the likelier regression -- someone unblocking a local RLS problem.
    const sql = migrationSql();
    expect(sql, 'a later migration disables RLS').not.toMatch(
      /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
    // `[^;]*` rather than `[^;\n]*`: SQL wraps, and a GRANT whose TO clause sits
    // on the next line re-opens the door just as wide. PUBLIC counts as a
    // PostgREST role here because `anon` inherits everything granted to it.
    expect(sql, 're-granted to a PostgREST role').not.toMatch(
      /\bGRANT\b[^;]*\bTO\s+(?:"?anon"?|"?authenticated"?|PUBLIC)\b/i,
    );
  });

  it('never forces RLS on the owner, which would lock the app out', () => {
    // The app connects as the table owner, who bypasses RLS. FORCE ROW LEVEL
    // SECURITY removes that bypass and would 500 every route.
    expect(migrationSql()).not.toContain('FORCE ROW LEVEL SECURITY');
  });
});
