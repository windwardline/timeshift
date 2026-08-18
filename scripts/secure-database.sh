#!/usr/bin/env bash
# Apply the security migrations to one Supabase project, verify the result, and
# rotate the credentials that were exposed. Everything the lockdown needs, in one
# command, run once per project:
#
#   ./scripts/secure-database.sh "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"
#
# Flags:
#   --skip-rotation   apply and verify, but do not sign existing users out
#   --verify-only     change nothing; just report whether the lockdown is in force
#   --yes             do not prompt (for non-interactive use)
#
# Safe to re-run: `migrate deploy` skips migrations already applied, and the
# verification is read-only.
set -euo pipefail

URL="" SKIP_ROTATION=0 VERIFY_ONLY=0 ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --skip-rotation) SKIP_ROTATION=1 ;;
    --verify-only)   VERIFY_ONLY=1 ;;
    --yes|-y)        ASSUME_YES=1 ;;
    -*)              echo "unknown flag: $arg" >&2; exit 2 ;;
    *)               URL="$arg" ;;
  esac
done
[ -n "$URL" ] || URL="${DATABASE_URL:-}"
if [ -z "$URL" ] && [ -t 0 ]; then
  # Ask rather than fail. Nothing in this script should need editing before it is
  # run -- a command with a placeholder in it is a command that gets pasted with
  # the placeholder still in it.
  printf '\n'
  printf 'Paste the Supabase connection string for the project you want to secure.\n'
  printf '  Supabase -> Project Settings -> Database -> Connection string -> URI\n'
  printf '  Use port 5432 (direct or session), NOT 6543.\n'
  printf '  Input is hidden; the project it points at is echoed back for you to check.\n\n'
  printf 'connection string: '
  read -r -s URL </dev/tty || true
  printf '\n'
fi
if [ -z "$URL" ]; then
  echo "error: no connection string given." >&2
  echo "  Supabase → Project Settings → Database → Connection string → URI" >&2
  exit 2
fi

cd "$(dirname "$0")/.."
say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- Preflight ---------------------------------------------------------------
say "== preflight =="

[ -d node_modules/prisma ] || fail "node_modules is missing — run 'npm ci' first.
  Without it, npx downloads Prisma 7, which rejects this repo's schema.prisma
  (this project is pinned to Prisma 6; see AGENTS.md §3)."

PRISMA_VERSION="$(node -p "require('./node_modules/prisma/package.json').version")"
case "$PRISMA_VERSION" in
  6.*) say "  prisma            $PRISMA_VERSION (local, pinned major)" ;;
  *)   fail "local prisma is $PRISMA_VERSION; this repo requires 6.x (AGENTS.md §3)." ;;
esac

# Which project is this actually pointing at? The single most useful thing to
# show, because running the same command twice against one project is the easy
# mistake and it looks identical to success.
REF="$(printf '%s' "$URL" | sed -n 's#.*db\.\([a-z0-9]\{20\}\)\.supabase\.co.*#\1#p')"
[ -n "$REF" ] || REF="$(printf '%s' "$URL" | sed -n 's#.*://postgres\.\([a-z0-9]\{20\}\)[:@].*#\1#p')"
case "$REF" in
  fjmueibdhwbsmjvzxeru) say "  target            $REF  (PRODUCTION — live user data)" ;;
  nmubttlwdgdhnkdhrivh) say "  target            $REF  (timeshift-preview)" ;;
  "")                   say "  target            could not identify project from the URL" ;;
  *)                    say "  target            $REF  (unrecognised project)" ;;
esac

# Migrations need session-level advisory locks; the transaction pooler drops them.
case "$URL" in
  *:6543*) fail "that is the transaction pooler (port 6543), which cannot run migrations.
  Use the direct connection or session pooler (port 5432) from the same page." ;;
  *:5432*) say "  port              5432 (direct/session — correct for migrations)" ;;
  *)       say "  port              not 6543 — assuming it is migration-capable" ;;
esac

if [ "$VERIFY_ONLY" = 1 ]; then
  say ""; say "== verify only (no changes) =="
  DATABASE_URL="$URL" node scripts/verify-lockdown.mjs
  exit $?
fi

# --- Plan --------------------------------------------------------------------
say ""
say "== plan =="
say "  1. prisma migrate deploy   (lockdown, RateLimit table, drop passwordHash)"
say "  2. verify RLS and grants on every table in the public schema"
if [ "$SKIP_ROTATION" = 1 ]; then
  say "  3. SKIPPED: token rotation (--skip-rotation)"
else
  say "  3. expire every session and burn unconsumed magic links"
  say "     -> signs all users out; they sign in again as normal."
  say "     These were readable during the exposure window, so rotating is part"
  say "     of the fix, not an optional extra. Use --skip-rotation to defer."
fi

if [ "$ASSUME_YES" != 1 ]; then
  say ""
  printf 'proceed against %s? [y/N] ' "${REF:-this database}"
  read -r reply </dev/tty || reply=""
  case "$reply" in [yY]*) ;; *) say "aborted; nothing was changed."; exit 1 ;; esac
fi

# --- Apply -------------------------------------------------------------------
say ""; say "== migrate =="
DATABASE_URL="$URL" ./node_modules/.bin/prisma migrate deploy

say ""; say "== verify =="
set +e
DATABASE_URL="$URL" node scripts/verify-lockdown.mjs
VERIFY_STATUS=$?
set -e
[ "$VERIFY_STATUS" = 0 ] || fail "verification failed — see the table above. Nothing was rotated."

if [ "$SKIP_ROTATION" != 1 ]; then
  say ""; say "== rotate exposed credentials =="
  DATABASE_URL="$URL" ./node_modules/.bin/prisma db execute --url "$URL" --stdin <<'SQL'
UPDATE "Session"    SET "expiresAt" = now() WHERE "expiresAt" > now();
UPDATE "LoginToken" SET "usedAt"    = now() WHERE "usedAt" IS NULL;
SQL
  say "  sessions expired and unconsumed magic links burned."
fi

say ""
say "done for ${REF:-this project}."

# Both Supabase projects need this, and doing one and forgetting the other is the
# failure mode with no symptom. Offer the second rather than describing it.
if [ "$ASSUME_YES" != 1 ] && [ -t 0 ]; then
  case "$REF" in
    fjmueibdhwbsmjvzxeru) OTHER="timeshift-preview (nmubttlwdgdhnkdhrivh)" ;;
    nmubttlwdgdhnkdhrivh) OTHER="production (fjmueibdhwbsmjvzxeru)" ;;
    *)                    OTHER="the other project" ;;
  esac
  say ""
  printf 'secure %s now as well? [Y/n] ' "$OTHER"
  read -r again </dev/tty || again=""
  case "$again" in
    [nN]*) say "stopping. Re-run this script for $OTHER when ready." ;;
    *)     say ""; exec "$0" ;;
  esac
else
  [ "$REF" = "fjmueibdhwbsmjvzxeru" ] && say "next: run this again for timeshift-preview."
fi
exit 0
