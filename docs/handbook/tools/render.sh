#!/usr/bin/env bash
# Render Mermaid sources in docs/handbook/diagrams/*.mmd to
# docs/handbook/assets/diagrams/<name>.png (white background, scale 3).
#
# Usage (from anywhere):
#   bash docs/handbook/tools/render.sh                 # every stale diagram
#   bash docs/handbook/tools/render.sh ch28-patient-status   # named ones (no .mmd)
#
# Uses the locally installed Chrome (tools/puppeteer.json); never downloads a browser.
set -u
HB="$(cd "$(dirname "$0")/.." && pwd)"
export PUPPETEER_SKIP_DOWNLOAD=true
cd "$HB" || exit 1

if [ $# -gt 0 ]; then
  names=("$@")
else
  names=()
  for f in diagrams/*.mmd; do
    n="$(basename "$f" .mmd)"
    [ "$n" = "_test" ] && continue
    out="assets/diagrams/$n.png"
    if [ ! -f "$out" ] || [ "$f" -nt "$out" ]; then names+=("$n"); fi
  done
fi

fail=0
for n in "${names[@]}"; do
  src="diagrams/$n.mmd"
  out="assets/diagrams/$n.png"
  if [ ! -f "$src" ]; then echo "MISSING $src"; fail=1; continue; fi
  if npx -y @mermaid-js/mermaid-cli@11 -i "$src" -o "$out" -b white -s 3 \
       -p tools/puppeteer.json -c tools/mermaid-config.json >"$HB/tools/.render-$$.log" 2>&1; then
    echo "OK   $n"
  else
    echo "FAIL $n"; sed -n '1,12p' "$HB/tools/.render-$$.log"; fail=1
  fi
done
rm -f "$HB/tools/.render-$$.log"
exit $fail
