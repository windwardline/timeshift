#!/bin/sh
# Reusable TDD evidence capture.
#
# Runs the Vitest suite ONCE with two reporters:
#   - default -> stdout, captured to a text log    -> docs/logs/<label>.txt
#   - json    -> a results file, rendered to a     -> docs/screenshots/<label>.png
#                colored red/green report
# Both artifacts come from the same run, so they can never disagree.
#
# Usage: sh scripts/capture-tdd.sh <NN-name-(red|green)> [...vitest args]
#   e.g. sh scripts/capture-tdd.sh 01-offsets-red lib/engine/time.test.ts
#
# No `set -e`: a Red run's Vitest exits non-zero by design and we still render it.
set -u

label="${1:?usage: capture-tdd.sh <NN-name-(red|green)> [...vitest args]}"
shift

txt="$(mktemp)"
json="$(mktemp)"

npx vitest run "$@" --reporter=default --reporter=json --outputFile="$json" >"$txt" 2>&1 || true

node scripts/render-tdd.mjs "$label" "$txt" "$json"

rm -f "$txt" "$json"
