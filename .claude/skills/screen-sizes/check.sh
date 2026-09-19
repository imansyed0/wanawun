#!/bin/bash
# Run one route through the common phone sizes and report layout breakage.
#
#   ./check.sh /flashcards
#   ./check.sh /flashcards "Reveal answer"      # tap something first
#   SIZES="375x812 390x772" ./check.sh /learn   # narrow the sweep
#
# Needs the dev server up (npx expo start --web) and credentials, exactly like
# the run-wanawun driver, whose profile this reuses.
set -u
route="${1:-/flashcards}"
tap="${2:-}"

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
driver="$repo/.claude/skills/run-wanawun/driver.mjs"
tmp="${TMPDIR:-/tmp}/wanwun-size-check"
mkdir -p "$tmp"

# Logical points, portrait. The "minus insets" rows stand in for a real device:
# a browser has no safe-area insets, so a phone has roughly 70-90pt less than
# its spec height once the notch and tab bar are taken out.
default_sizes="360x600 360x640 375x667 375x740 375x812 390x772 390x844 412x915 430x932 768x1024"
sizes="${SIZES:-$default_sizes}"

printf '%-11s %s\n' "SIZE" "RESULT"
fail=0
for size in $sizes; do
  w="${size%x*}"; h="${size#*x}"
  sed "s/--window-size=430,900/--window-size=$w,$h/" "$driver" > "$tmp/driver.mjs"
  args=(goto "$route")
  [ -n "$tap" ] && args+=(tap "$tap")
  args+=(eval "$(cat "$here/probe.js")")
  # The driver prints its own goto/tap lines first; keep only the JSON, and
  # squash the pretty-printer's whitespace so the match below is simple.
  out=$(node "$tmp/driver.mjs" "${args[@]}" 2>&1 | tr -d '\n' | sed 's/.*{"size"/{"size"/' | tr -s ' ')
  if printf '%s' "$out" | grep -q '"ok": *true'; then
    printf '%-11s OK\n' "$size"
  else
    fail=1
    printf '%-11s %s\n' "$size" "$out"
  fi
done

[ "$fail" -eq 0 ] && echo "All sizes clean." || echo "Breakage above. Screenshot the failing size before changing anything."
exit "$fail"
