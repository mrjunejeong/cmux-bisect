#!/usr/bin/env bash
# Materialize a runnable copy of an example into a fresh git repo.
# Why: the example *templates* in examples/ are plain files (no nested .git)
# so the outer cmux-bisect repo stays clean. cmux-bisect needs a real git
# repo to fork worktrees from, so we create one on demand.
#
# Usage:
#   scripts/init-example.sh                   # default: examples/sort-bug → ./tmp-demo/sort-bug
#   scripts/init-example.sh sort-bug          # same
#   scripts/init-example.sh sort-bug /tmp/foo # custom destination

set -euo pipefail

EXAMPLE="${1:-sort-bug}"
DST="${2:-./tmp-demo/${EXAMPLE}}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/examples/${EXAMPLE}"

if [ ! -d "$SRC" ]; then
  echo "ERROR: example not found: $SRC" >&2
  echo "Available: $(ls "$(dirname "$0")/../examples")" >&2
  exit 1
fi

rm -rf "$DST"
mkdir -p "$DST"
cp -r "$SRC"/. "$DST"/

cd "$DST"
git init -q
git config user.email "demo@cmux-bisect.local"
git config user.name  "cmux-bisect demo"
git add -A
git commit -q -m "initial broken state"

ABS_DST="$(pwd)"
echo "✓ ${EXAMPLE} ready at: ${ABS_DST}"
echo "  baseline commit: $(git rev-parse --short HEAD)"
echo ""
echo "Verify the bug exists (oracle should FAIL):"
echo "  bash ${ABS_DST}/run-tests.sh"
echo ""
echo "Run cmux-bisect against it:"
echo "  npx tsx src/cli.ts capture-run --repo ${ABS_DST} --run-id GOOD --prompt '...'"
