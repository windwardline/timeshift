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
// Known limits, so nobody over-trusts it. It matches text across the whole
// migration set, so a later migration that DROPs and re-CREATEs a modelled table
// still passes -- the original ENABLE line remains in the concatenation while the
// recreated table has RLS off. It also reads SQL as text, so a grant assembled
// from pieces at runtime (concatenating the word GRANT, or naming the role
// through a variable rather than a `format()` placeholder) is beyond it.
//
// It errs the other way too: because `%s` is in the alternation, ANY dynamic
// grant trips it -- including a legitimate `format('GRANT USAGE ON SCHEMA public
// TO %I', 'postgres')`, which would fail as "re-granted to a PostgREST role" and
// so misdescribe itself. Safe direction to be wrong in, but read the message with
// that in mind. The lockdown's second layer covers that case (the
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

// The two matchers that decide whether the lockdown has been undone. Module
// constants rather than inline literals so they can be probed directly: asserted
// only against the real migrations -- which contain no GRANT at all -- nothing
// would distinguish a working matcher from a broken one, and deleting `%I|%s` or
// narrowing `[^;]*` back to `[^;\n]*` would leave the suite green.
//
// `[^;]*` rather than `[^;\n]*` because SQL wraps, and a GRANT whose TO clause
// sits on the next line re-opens the door just as wide. PUBLIC counts as a
// PostgREST role because `anon` inherits everything granted to it. `%I` and `%s`
// are in the alternation because the lockdown migration does all of its privilege
// work dynamically -- `format('REVOKE ALL ON TABLE %s FROM %I', obj.ident, r)` --
// so the likeliest re-grant is that block copied with REVOKE swapped for GRANT,
// where no role name appears literally at all.
const DISABLES_RLS = /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i;
const RE_GRANTS_TO_POSTGREST_ROLE =
  /\bGRANT\b[^;]*\bTO\s+(?:"?anon"?|"?authenticated"?|PUBLIC|%I|%s)\b/i;

// The stripper is the single point of failure for every assertion below: if it
// ever blanked a real statement, all four negatives would pass on empty text and
// this guard would go silently green. It is a hand-written state machine living in
// a test file, so the coverage gate does not reach it -- these cases are what stop
// a later "simplify this back to a regex" edit from reintroducing the bug it was
// written to fix.
describe('stripSqlComments', () => {
  it('removes line comments', () => {
    expect(stripSqlComments('SELECT 1; -- a trailing note\nSELECT 2;')).not.toContain('note');
  });

  it('removes block comments, including across lines', () => {
    expect(stripSqlComments('SELECT 1; /* a\n note */ SELECT 2;')).not.toContain('note');
  });

  it('keeps a real statement that follows a literal containing --', () => {
    // The case a regex stripper gets wrong: it treats the `--` inside the literal
    // as a comment, blanks the rest of the line, and hides the GRANT after it.
    const sql = `INSERT INTO "C" VALUES ('a--b');  GRANT ALL ON "Session" TO anon;`;
    expect(stripSqlComments(sql)).toContain('GRANT ALL ON "Session" TO anon');
  });

  it("preserves '' escapes inside a literal rather than ending the string early", () => {
    const sql = `INSERT INTO "C" VALUES ('it''s -- fine');  GRANT ALL ON "S" TO anon;`;
    expect(stripSqlComments(sql)).toContain('GRANT ALL ON "S" TO anon');
  });

  it('leaves ordinary SQL untouched', () => {
    const sql = 'ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;';
    expect(stripSqlComments(sql)).toContain(sql);
  });

  it('strips prose that would otherwise trip the negative matchers', () => {
    const stripped = stripSqlComments(
      '-- we no longer grant SELECT on this table to anon\n' +
        '-- and we never DISABLE ROW LEVEL SECURITY here\n',
    );
    expect(stripped).not.toMatch(/grant/i);
    expect(stripped).not.toMatch(/DISABLE/i);
  });
});

// The matchers encode the security contract; the stripper only prepares their
// input. Verifying the input path and not the decision path would leave the
// guard's most load-bearing lines unpinned, so these exercise the regexes directly.
describe('negative matchers', () => {
  const grants = (sql: string) => RE_GRANTS_TO_POSTGREST_ROLE.test(sql);

  it('catches the lockdown block copied with REVOKE swapped for GRANT', () => {
    expect(grants(`EXECUTE format('GRANT ALL ON TABLE %s TO %I', obj.ident, r);`)).toBe(true);
  });

  it('catches a dynamic grant naming a PostgREST role literally', () => {
    expect(grants(`EXECUTE format('GRANT SELECT ON %s TO anon', obj.ident);`)).toBe(true);
  });

  it('catches a grant whose TO clause wraps to the next line', () => {
    expect(grants('GRANT SELECT ON "User"\n  TO anon;')).toBe(true);
  });

  it('catches a grant to PUBLIC, which anon inherits', () => {
    expect(grants('GRANT SELECT ON "User" TO PUBLIC;')).toBe(true);
  });

  it('leaves the REVOKE idiom the migrations actually use alone', () => {
    expect(grants(`EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', obj.ident, r);`)).toBe(false);
  });

  it('catches RLS being disabled, and does not confuse it with enabling', () => {
    expect(DISABLES_RLS.test('ALTER TABLE "S" DISABLE ROW LEVEL SECURITY;')).toBe(true);
    expect(DISABLES_RLS.test('ALTER TABLE "S"\n  DISABLE ROW\n  LEVEL SECURITY;')).toBe(true);
    expect(DISABLES_RLS.test('ALTER TABLE "S" ENABLE ROW LEVEL SECURITY;')).toBe(false);
  });
});

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
    expect(sql, 'a later migration disables RLS').not.toMatch(DISABLES_RLS);
    expect(sql, 're-granted to a PostgREST role').not.toMatch(RE_GRANTS_TO_POSTGREST_ROLE);
  });

  it('never forces RLS on the owner, which would lock the app out', () => {
    // The app connects as the table owner, who bypasses RLS. FORCE ROW LEVEL
    // SECURITY removes that bypass and would 500 every route.
    expect(migrationSql()).not.toContain('FORCE ROW LEVEL SECURITY');
  });
});
