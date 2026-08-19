import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { stripSqlComments } from './scripts/sql-text.mjs';

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
// Known limits, so nobody over-trusts it. Four of them, each with its own
// mitigation or lack of one.
//
// 1. It matches text across the whole migration set, so a later migration that
//    DROPs and re-CREATEs a modelled table still passes: the original ENABLE line
//    remains in the concatenation while the recreated table has RLS off. The
//    lockdown's second layer still covers that case -- the ALTER DEFAULT
//    PRIVILEGES revoke is persistent server state, so the recreated table gets no
//    anon grant -- but the diff would be down to one layer, and only a live check
//    against the database itself would catch it here.
//
// 2. It reads SQL as text, so a grant assembled from pieces at runtime
//    (concatenating the word GRANT, or naming the role through a variable rather
//    than a `format()` placeholder) is beyond it entirely. No mitigation in this
//    file; the grants layer of the lockdown is what would still be standing.
//
// 3. It errs the other way too: `%I` and `%s` are in the alternation, so ANY
//    dynamic grant trips it -- including a legitimate
//    `format('GRANT USAGE ON SCHEMA public TO %I', 'postgres')`, which matches on
//    the `%I` and would fail as "re-granted to a PostgREST role", misdescribing
//    itself. That is the safe direction to be wrong in, but read the message with
//    this in mind before assuming a re-grant to anon.
//
// 4. The stripper decides whether a dollar-quoted body is code or data from its
//    opener (`DO`/`AS` means code, so plpgsql comments inside it are stripped;
//    anything else is treated as a data literal and copied verbatim). A code body
//    introduced some other way would be read as data, leaving its comments in the
//    text the matchers see -- noisy rather than blind, so it fails toward red.

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
// Why it is quote-aware rather than a regex, and the rest of the reasoning, lives
// with the implementation in scripts/sql-text.mjs -- shared with the paste-file
// generator, which reads the same migrations.

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
// Same shape as DISABLES_RLS, and for the same reason: this line can only ever be
// hand-written, since Prisma does not model RLS -- and hand-written is exactly
// where casing and line wrapping vary. Postgres keywords are case-insensitive, so
// `force row level security` is a valid statement an exact substring never sees.
const FORCES_RLS = /(?<!\bNO\s{1,40})FORCE\s+ROW\s+LEVEL\s+SECURITY/i;
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

  it('keeps a real statement that follows a dollar-quoted literal containing --', () => {
    // Postgres has two string syntaxes and this is the second one. Same defect as
    // the `'a--b'` case above: if the body is not recognised as a literal, the
    // `--` inside it blanks the rest of the line and takes the GRANT with it.
    const sql = `INSERT INTO "Doc" VALUES ($t$a--b$t$);  GRANT ALL ON "User" TO anon;`;
    expect(stripSqlComments(sql)).toContain('GRANT ALL ON "User" TO anon');
  });

  it('treats an untagged $$ data literal as a literal too', () => {
    const sql = `INSERT INTO "Doc" VALUES ($$a--b$$);  GRANT ALL ON "User" TO anon;`;
    expect(stripSqlComments(sql)).toContain('GRANT ALL ON "User" TO anon');
  });

  it('still strips plpgsql comments inside a DO block body', () => {
    // The other half, and why a dollar-quoted body cannot simply be skipped: the
    // lockdown migration explains itself at length inside `DO $$ ... $$`, and that
    // prose must not reach the matchers -- limits 2 and 3 discuss GRANT and anon.
    const sql = `DO $$\nBEGIN\n  -- we no longer grant SELECT on this to anon\n  PERFORM 1;\nEND\n$$;`;
    const stripped = stripSqlComments(sql);
    expect(stripped).not.toMatch(/grant/i);
    expect(stripped).toContain('PERFORM 1;');
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

  it('does not block the statement that undoes a FORCE', () => {
    // `NO FORCE ROW LEVEL SECURITY` is what someone writes to repair a database
    // where FORCE was set by hand. Blocking it would refuse the fix while quoting
    // a message about causing the problem.
    expect(FORCES_RLS.test('ALTER TABLE "User" NO FORCE ROW LEVEL SECURITY;')).toBe(false);
    expect(FORCES_RLS.test('alter table "User" no force row level security;')).toBe(false);
  });

  it('catches RLS being forced, whatever the casing or wrapping', () => {
    // Forcing RLS strips the owner's bypass, which the app depends on: every route
    // would 500. Availability rather than exposure, but it is what this catches.
    expect(FORCES_RLS.test('ALTER TABLE "User" FORCE ROW LEVEL SECURITY;')).toBe(true);
    expect(FORCES_RLS.test('alter table "User" force row level security;')).toBe(true);
    expect(FORCES_RLS.test('ALTER TABLE "User"\n  FORCE ROW\n  LEVEL SECURITY;')).toBe(true);
    expect(FORCES_RLS.test('ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;')).toBe(false);
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

  it('revokes default privileges on every object class pg_default_acl can hold', () => {
    // pg_default_acl stores one row per (role, schema, object class). Covering
    // only TABLES and SEQUENCES leaves the FUNCTIONS and TYPES rows standing,
    // and both tools that read pg_default_acl then report a correctly locked
    // database as exposed -- secure-database.sh treats that as a hard failure
    // and skips credential rotation, and the paste file's one result grid says
    // PROBLEM. Revoking the whole surface is also the better answer on its own
    // terms: default EXECUTE to anon on a future public function is a live
    // PostgREST RPC endpoint. (Object class 'n', schemas, is stored with no
    // namespace, so an IN SCHEMA public sweep never sees it.)
    const sql = migrationSql();
    for (const objectClass of ['TABLES', 'SEQUENCES', 'FUNCTIONS', 'TYPES']) {
      expect(sql, `default privileges on ${objectClass} never revoked`).toMatch(
        new RegExp(
          String.raw`ALTER\s+DEFAULT\s+PRIVILEGES\s+IN\s+SCHEMA\s+public\s+REVOKE\s+ALL\s+ON\s+` +
            objectClass,
          'i',
        ),
      );
    }
  });

  it('revokes EXECUTE on future functions from PUBLIC, not just the named roles', () => {
    // Revoking from anon and authenticated by name does NOT close this. Postgres
    // grants EXECUTE on every new function to PUBLIC as a built-in default, anon
    // is a member of PUBLIC, and anon keeps USAGE on the schema through PUBLIC
    // too (20260818204500 says so itself). PostgREST publishes a public function
    // as an RPC endpoint, so the next SECURITY DEFINER helper -- which runs as
    // its owner and therefore bypasses RLS -- would return rows to anyone holding
    // the publishable key. Measured on a fully locked-down local database before
    // this line existed: anon could call it and read a user's email address.
    //
    // Asserted WITHOUT `IN SCHEMA`, which is the part that is easy to get wrong
    // and impossible to notice: the schema-qualified spelling writes no
    // pg_default_acl row and changes nothing, because a schema-scoped entry is
    // layered on top of the built-in defaults rather than able to subtract from
    // them. Only the database-wide form takes effect. Both were run on Postgres
    // 16.13 before this was written.
    expect(migrationSql()).toMatch(
      /ALTER\s+DEFAULT\s+PRIVILEGES\s+REVOKE\s+EXECUTE\s+ON\s+FUNCTIONS\s+FROM\s+PUBLIC/i,
    );
    expect(
      migrationSql(),
      'IN SCHEMA public silently does nothing for the built-in PUBLIC default',
    ).not.toMatch(
      /ALTER\s+DEFAULT\s+PRIVILEGES\s+IN\s+SCHEMA\s+\w+\s+REVOKE\s+EXECUTE\s+ON\s+FUNCTIONS\s+FROM\s+PUBLIC/i,
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
    expect(migrationSql()).not.toMatch(FORCES_RLS);
  });
});
