// Shared by security-rls.test.ts (which reads migrations to enforce the RLS
// contract) and scripts/generate-supabase-sql.mjs (which reads the same
// migrations to build the paste file). One implementation, because a second
// copy of a comment stripper is a second set of quoting bugs.
//
/**
 * Remove SQL comments, leaving anything inside a string literal untouched.
 *
 * Postgres has two string syntaxes and both matter here. `'…'` is the obvious
 * one. Dollar quoting (`$$…$$`, `$tag$…$tag$`) is the other, and it is used two
 * ways in these migrations, which the same rule cannot serve:
 *
 *   - as a DATA literal — `VALUES ($t$a--b$t$)` — where the `--` is content, and
 *     treating it as a comment would blank the rest of the line and take any
 *     statement after it out of the matchers' sight. Silently green, the exact
 *     defect the `'…'` handling exists to prevent.
 *   - as a CODE body — `DO $$ … $$` — where the lockdown migration explains
 *     itself at length in plpgsql `--` comments. Those must still be stripped:
 *     that prose discusses GRANT, anon and PUBLIC, and letting it reach the
 *     matchers is what made the guard prose-sensitive two rounds ago.
 *
 * The two are indistinguishable from the delimiter alone, so the opener decides:
 * a dollar quote introduced by `DO` or `AS` is a code body and its contents are
 * stripped recursively; any other is data and is copied out verbatim. That covers
 * how Postgres actually spells these — recorded as limit 4, since a code body
 * introduced some other way would be treated as data.
 */
export function stripSqlComments(sql) {
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
    } else if (c === '$' && /^\$[A-Za-z_0-9]*\$/.test(sql.slice(i))) {
      const tag = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i))[0];
      const close = sql.indexOf(tag, i + tag.length);
      const bodyEnd = close === -1 ? sql.length : close;
      const body = sql.slice(i + tag.length, bodyEnd);
      const isCodeBody = /\b(?:DO|AS)\s*$/i.test(out);
      out += tag + (isCodeBody ? stripSqlComments(body) : body) + (close === -1 ? '' : tag);
      i = close === -1 ? sql.length : close + tag.length;
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
