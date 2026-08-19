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
//
// Note on coverage: vitest.config.ts scopes the 100% target to lib/**, so the
// suite's coverage number says nothing about this file. Its branches are covered
// only by the explicit cases in supabase-lockdown-sql.test.ts, which is why new
// ones are added there whenever a hole is found rather than trusted to a number.
import { dollarTagAt, stripSqlComments } from './sql-text.mjs';

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
    // An upsert has to clear the self-reference check too: ON CONFLICT alone
    // makes the INSERT re-runnable, but DO UPDATE SET "n" = "n" + 1 climbs on
    // every paste just as the bare UPDATE would. SAFE.find returns this entry
    // first, so without this the UPDATE rule below never sees it.
    safe: (statement, mask) =>
      (/\bON\s+CONFLICT\b|\bWHERE\s+NOT\s+EXISTS\b/i.test(mask) &&
        !/\bDO\s+UPDATE\b/i.test(mask)) ||
      (/\bDO\s+UPDATE\b/i.test(mask) && setClauseVerdict(statement, mask) === SAFE_CLAUSE),
    // Two different defects reach this entry, so the remedy is chosen per reason
    // rather than canned: a missing conflict clause needs one adding, while an
    // upsert that increments a column needs the increment rewritten. Telling the
    // second author to add ON CONFLICT -- which they already have -- and to edit
    // REWRITES, which is a per-migration needle map, sends them two wrong ways.
    fix: (statement, mask) =>
      /\bON\s+CONFLICT\b|\bWHERE\s+NOT\s+EXISTS\b/i.test(mask)
        ? explain(setClauseVerdict(statement, mask))
        : 'Add a rewrite to REWRITES in scripts/rerunnable.mjs turning it into ' +
          '"INSERT ... ON CONFLICT DO NOTHING (or ... WHERE NOT EXISTS)".',
  },
  // UPDATE and DELETE are re-runnable when the change is idempotent -- setting a
  // column to a literal or a function of the row's identity, deleting rows
  // matching a predicate. An UPDATE is NOT re-runnable when the new value is
  // derived from the old one (SET "n" = "n" + 1 climbs on every paste), which is
  // what a self-reference in the SET clause shows and a WHERE clause cannot.
  {
    verb: /^UPDATE\b/i,
    safe: (statement, mask) => setClauseVerdict(statement, mask) === SAFE_CLAUSE,
    fix: (statement, mask) => explain(setClauseVerdict(statement, mask)),
  },
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
 * migration that is fine. Literal CONTENTS are then masked, so no keyword, comma
 * or bracket inside a string can be read as structure.
 *
 * Known limit, recorded because an earlier version of this comment claimed the
 * opposite: dynamic DDL is not judged. `EXECUTE format('CREATE TABLE ...')` does
 * collide on a second run, and masking hides it -- but nothing caught it before
 * masking either, because every such call in this repo sits inside a `DO $$ ...
 * $$` block, and `DO` is unconditionally safe in SAFE. A DO block is trusted to
 * do its own catalog checks; that is an assumption, not a verified property.
 * @param {string} name migration directory name, for the message
 * @param {string} sql the migration's SQL, after makeRerunnable
 */
export function assertRerunnable(name, sql) {
  for (const statement of statements(stripSqlComments(sql))) {
    // Masked once here and threaded through every scan below. Each site that
    // remembered to mask for itself was a site that could forget: the SET parser
    // masked, the INSERT predicate did not, and a literal saying ON CONFLICT was
    // read as a conflict clause. One mask, passed down, cannot drift apart.
    const mask = maskLiterals(statement);
    if (mask === null) {
      throw new Error(
        `${name}: ${JSON.stringify(preview(statement))} has an unterminated string literal, so ` +
          'scripts/rerunnable.mjs cannot judge whether it is safe to run twice.',
      );
    }
    const entry = SAFE.find((e) => e.verb.test(mask));
    if (!entry) {
      throw new Error(
        `${name}: ${JSON.stringify(preview(statement))} is a statement scripts/rerunnable.mjs ` +
          'does not know how to judge, and docs/supabase-lockdown.sql promises it is safe to run ' +
          'twice. Add it to SAFE with the pattern its re-runnable form must match.',
      );
    }
    const rules = entry.sub ?? [{ find: null, safe: entry.safe, fix: entry.fix }];
    const matched = rules.filter((rule) => !rule.find || rule.find.test(mask));
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
      if (rule.safe && matches(rule.safe, statement, mask)) continue;
      {
        throw new Error(
          `${name}: ${JSON.stringify(preview(statement))} aborts if ` +
            'docs/supabase-lockdown.sql is pasted twice, and that file promises it is safe to ' +
            'run twice. ' +
            remedy(rule.fix, statement, mask),
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
    if (sql[i] === '"') {
      const close = sql.indexOf('"', i + 1);
      const end = close === -1 ? sql.length : close + 1;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
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
    const tag = dollarTagAt(sql, i);
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
 * Regexes are tested against the MASK, so a keyword inside a string literal is
 * never mistaken for syntax; predicates get both and decide.
 * @param {RegExp | ((statement: string, mask: string) => boolean)} safe
 * @param {string} statement
 * @param {string} mask
 */
function matches(safe, statement, mask) {
  return typeof safe === 'function' ? safe(statement, mask) : safe.test(mask);
}

/** The clause is re-runnable. */
const SAFE_CLAUSE = null;
/** An assignment reads the column it writes, so the value climbs on every run. */
const SELF_REFERENCE = 'self-reference';
/**
 * The clause could not be decomposed. A distinct verdict from SELF_REFERENCE
 * because it means something different to the author: the statement may be
 * perfectly re-runnable and simply not a shape this can judge, so the message
 * must say so rather than assert a defect that was never observed.
 */
const UNPARSEABLE = 'unparseable';

/**
 * Why a statement's SET clauses are not safe to run twice, or SAFE_CLAUSE when
 * they are. Returns a reason rather than a boolean: every assignment writes a value that
 * does not read the column being written. `SET "n" = "n" + 1` climbs on every
 * run; `SET "expiresAt" = now()` does not.
 *
 * Literal contents are masked before anything is scanned. Three separate bugs
 * came from scanning raw text -- a WHERE, then a FROM, then a dollar-quoted
 * body, each read as structure because it sat inside a value. Teaching the
 * scanner one more keyword each time was treating the symptom; a literal simply
 * must not be readable as structure, so its contents are blanked positionally
 * and every index-based scan runs on the mask while slices come from the original.
 *
 * Refuses -- rather than accepting -- anything it cannot decompose. Returning
 * `true` on "I could not parse this" is how a guard that reads as an allowlist
 * behaves like a denylist.
 *
 * @param {string} statement
 * @param {string} mask same-length copy with literal contents blanked
 * @returns {null | 'self-reference' | 'unparseable'}
 */
function setClauseVerdict(statement, mask) {
  // Every SET clause, not just the first: an upsert carries its increment in
  // `ON CONFLICT ... DO UPDATE SET`, which is where this shape usually appears.
  // Matched on the mask, so the word SET inside a literal is not one.
  const clauses = [...mask.matchAll(/\bSET\b/gi)].map((m) =>
    sliceSetClause(statement, mask, m.index + m[0].length),
  );
  if (clauses.length === 0) return UNPARSEABLE;
  for (const clause of clauses) {
    if (clause === null) return UNPARSEABLE; // unbalanced, or cut inside an expression
    const assignments = splitTopLevel(clause);
    if (assignments.length === 0) return UNPARSEABLE;
    for (const { text, mask: assignmentMask } of assignments) {
      const eq = assignmentMask.indexOf('=');
      if (eq === -1) return UNPARSEABLE;
      const lhs = text.slice(0, eq).trim();
      // Both the single-column form and the multi-column `("a","b") = (1, 2)`.
      const columns = /^\(.*\)$/s.test(lhs)
        ? identifiers(lhs)
        : [lhs.replace(/^"|"$/g, '')].filter((c) => /^[A-Za-z_][\w$]*$/.test(c));
      if (columns.length === 0) return UNPARSEABLE; // not a shape this can judge
      // EXCLUDED.<col> is the proposed row, not the stored one, so an upsert
      // written `SET x = EXCLUDED.x` is re-runnable. Dropped before the test so
      // it cannot look like a self-reference -- and dropped only here, so a real
      // self-reference sitting beside it is still seen.
      // Sliced from the mask, like every other scan. Reading the original here
      // let identifiers() harvest words out of a literal, so a constant whose
      // text happened to contain the column's own name looked like a
      // self-reference. EXCLUDED."x" is code, not a literal, so it survives
      // masking and the strip below still applies.
      const value = assignmentMask.slice(eq + 1).replace(/\bexcluded\s*\.\s*"?[\w$]+"?/gi, '');
      // Compared as tokens rather than through a regex built from the column
      // name. A constructed pattern is a ReDoS surface, and it needs the column
      // escaped or a `$` in an identifier becomes an end-of-input anchor and the
      // reference silently never matches -- which is exactly how this check was
      // broken once already. String equality has neither failure mode.
      const read = identifiers(value).map((id) => id.toLowerCase());
      if (columns.some((c) => read.includes(c.toLowerCase()))) return SELF_REFERENCE;
    }
  }
  return SAFE_CLAUSE;
}

/**
 * Every identifier in an expression, quoted or bare.
 * @param {string} expression
 * @returns {string[]}
 */
function identifiers(expression) {
  return [...expression.matchAll(/"([^"]*)"|([A-Za-z_][\w$]*)/g)].map((m) => m[1] ?? m[2]);
}

/**
 * A copy of `sql` with the CONTENTS of every string literal replaced by spaces,
 * so positions still line up with the original but nothing inside a literal can
 * be read as syntax. Handles `'…'` (with `''` escapes) and `$tag$…$tag$`.
 * Returns `null` when a literal is never closed.
 * @param {string} sql
 * @returns {string | null}
 */
function maskLiterals(sql) {
  let out = '';
  for (let i = 0; i < sql.length; ) {
    // A quoted identifier is a NAME, copied through untouched. Checked first, and
    // this ordering is the whole point: Postgres allows $ in an identifier, so
    // "p$x$" would otherwise open a dollar quote that closes at the next one and
    // blank everything between -- erasing a self-reference rather than corrupting
    // the parse, which is the one direction that can make the verdict cleaner
    // than the truth.
    if (sql[i] === '"') {
      const close = sql.indexOf('"', i + 1);
      if (close === -1) return null;
      out += sql.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    const tag = dollarTagAt(sql, i);
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length);
      if (close === -1) return null;
      out += tag + ' '.repeat(close - i - tag.length) + tag;
      i = close + tag.length;
    } else if (sql[i] === "'") {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return null;
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      out += `'${' '.repeat(j - i - 1)}'`;
      i = j + 1;
    } else {
      out += sql[i];
      i += 1;
    }
  }
  return out;
}

/**
 * One SET clause: from `from` up to the first terminator that is not nested.
 * Scans the mask, slices the original. Returns `null` when the clause cannot be
 * delimited -- unbalanced brackets, or a stray closer meaning the scan lost the
 * plot, which is not a terminator in any valid statement.
 * @param {string} statement
 * @param {string} mask
 * @param {number} from index just past the SET keyword
 * @returns {{ text: string, mask: string } | null}
 */
function sliceSetClause(statement, mask, from) {
  let depth = 0;
  for (let i = from; i < mask.length; i += 1) {
    const c = mask[i];
    if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') {
      depth -= 1;
      if (depth < 0) return null;
    } else if (depth === 0) {
      if (c === ';') return cut(statement, mask, from, i);
      const word = /^(?:WHERE|RETURNING|FROM)\b/i.exec(mask.slice(i));
      if (word && (i === from || /\s/.test(mask[i - 1]))) return cut(statement, mask, from, i);
    }
  }
  return depth === 0 ? cut(statement, mask, from, mask.length) : null;
}

/** @returns {{ text: string, mask: string }} */
function cut(statement, mask, from, to) {
  return { text: statement.slice(from, to), mask: mask.slice(from, to) };
}

/**
 * Splits an assignment list on commas that are not nested, so a comma inside a
 * call or an array literal stays part of its value.
 * @param {{ text: string, mask: string }} clause
 * @returns {{ text: string, mask: string }[]}
 */
function splitTopLevel(clause) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < clause.mask.length; i += 1) {
    const c = clause.mask[i];
    if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push(cut(clause.text, clause.mask, start, i));
      start = i + 1;
    }
  }
  out.push(cut(clause.text, clause.mask, start, clause.mask.length));
  return out.filter((a) => a.text.trim().length > 0);
}

/**
 * The sentence for a SET-clause verdict. Kept distinct because "this is unsafe"
 * and "I could not read this" mean different things to whoever hits it: the
 * second may well be a statement that is fine, and telling that author to fix a
 * self-reference they did not write sends them looking for nothing.
 * @param {null | 'self-reference' | 'unparseable'} verdict
 */
function explain(verdict) {
  return verdict === SELF_REFERENCE
    ? 'Its SET clause assigns a value that reads the column it writes, so the row climbs on ' +
        'every paste. Assign a fixed value, or use EXCLUDED.<column>.'
    : 'scripts/rerunnable.mjs could not read that SET clause, so it refuses rather than ' +
        'guessing. If the statement is re-runnable, teach the parser the shape it uses.';
}

/**
 * The sentence telling an author what to do about a refusal. A string names the
 * re-runnable spelling; a function returns the whole sentence, for entries where
 * more than one defect lands on the same rule; `null` means there is no
 * idempotent form at all.
 * @param {string | null | ((statement: string, mask: string) => string)} fix
 * @param {string} statement
 * @param {string} mask
 */
function remedy(fix, statement, mask) {
  if (typeof fix === 'function') return fix(statement, mask);
  if (fix) return `Add a rewrite to REWRITES in scripts/rerunnable.mjs turning it into "${fix}".`;
  return (
    'This statement has no idempotent form — guard it in the migration with a DO block that ' +
    'checks the catalog first.'
  );
}

/** First line of a statement, for an error message that fits on a screen. */
function preview(statement) {
  const line = statement.split('\n')[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}
