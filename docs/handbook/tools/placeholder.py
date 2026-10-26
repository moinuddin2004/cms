"""Make a "screenshot pending" placeholder figure as SVG.

Usage:
  python docs/handbook/tools/placeholder.py <slug> "<Screen title>" ["<route, e.g. /patients>"]
Writes docs/handbook/assets/placeholders/<slug>.svg (1600x900, light grey box).
"""
import html
import os
import sys

if len(sys.argv) < 3:
    sys.exit(__doc__)

slug, title = sys.argv[1], sys.argv[2]
route = sys.argv[3] if len(sys.argv) > 3 else ""
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "assets", "placeholders", slug + ".svg")

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect x="4" y="4" width="1592" height="892" rx="24" fill="#f1f5f9" stroke="#94a3b8" stroke-width="6" stroke-dasharray="28 18"/>
  <text x="800" y="380" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="44" fill="#64748b">Screenshot pending</text>
  <text x="800" y="470" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="bold" fill="#334155">{html.escape(title)}</text>
  <text x="800" y="560" text-anchor="middle" font-family="Consolas, monospace" font-size="40" fill="#64748b">{html.escape(route)}</text>
</svg>
"""
with open(out, "w", encoding="utf-8") as f:
    f.write(svg)
print("OK", os.path.normpath(out))
