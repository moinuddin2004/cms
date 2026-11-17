"""Generate the app icon / adaptive icon / splash PNGs from the web brand mark.

The mark is the web app's favicon (web-app/public/favicon.svg): a white "M" on a
blue -> green diagonal gradient. Pure Python (no Pillow), so it runs anywhere:

    python mobile-app/scripts/make-brand-assets.py

Writes into mobile-app/assets/images/. Re-run after changing the colours below.
"""
import os
import struct
import zlib

BLUE = (0x25, 0x63, 0xEB)   # web theme_color #2563eb
GREEN = (0x05, 0x96, 0x69)  # web gradient end #059669
WHITE = (255, 255, 255)
SS = 3  # supersampling per axis (anti-aliasing)

# The "M" from favicon.svg in a 64x64 box: M16 47V17h8l8 13 8-13h8v30h-7V29l-9 13-9-13v18z
M_POLY = [(16, 47), (16, 17), (24, 17), (32, 30), (40, 17), (48, 17), (48, 47),
          (41, 47), (41, 29), (32, 42), (23, 29), (23, 47)]

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')


def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def inside_poly(x, y, poly):
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def inside_rrect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size, *, bg, mark_scale, rounded, mark_color=WHITE, transparent_bg=False, mark=True):
    """bg: 'gradient' | None. mark_scale: fraction of the canvas the 64-unit box spans."""
    rows = []
    box = size * mark_scale
    off = (size - box) / 2
    k = box / 64.0
    poly = [(off + px * k, off + py * k) for px, py in M_POLY]
    # Bounding box of the mark to skip the polygon test elsewhere.
    mx0 = min(p[0] for p in poly); mx1 = max(p[0] for p in poly)
    my0 = min(p[1] for p in poly); my1 = max(p[1] for p in poly)
    r = size * 14 / 64 if rounded else 0
    for y in range(size):
        row = []
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    fx = x + (sx + 0.5) / SS
                    fy = y + (sy + 0.5) / SS
                    in_mark = mark and mx0 <= fx <= mx1 and my0 <= fy <= my1 and inside_poly(fx, fy, poly)
                    if in_mark:
                        col, a = mark_color, 255
                    elif bg == 'gradient' and (not rounded or inside_rrect(fx, fy, 0, 0, size, size, r)):
                        t = (fx + fy) / (2 * size)
                        col = tuple(round(BLUE[i] + (GREEN[i] - BLUE[i]) * t) for i in range(3))
                        a = 255
                    else:
                        col, a = (0, 0, 0), 0 if transparent_bg or rounded else 255
                        if not transparent_bg and not rounded:
                            col = WHITE
                    acc[0] += col[0] * a; acc[1] += col[1] * a; acc[2] += col[2] * a; acc[3] += a
            n = SS * SS
            a = acc[3] / n
            if a > 0:
                row += [round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(a)]
            else:
                row += [0, 0, 0, 0]
        rows.append(row)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        # iOS / generic app icon: full-bleed square gradient, no transparency; the M spans the middle half.
        ('icon.png', 1024, dict(bg='gradient', mark_scale=1.0, rounded=False)),
        # Android adaptive: background = gradient square, foreground = white M (half the canvas,
        # inside the 66% safe zone).
        ('android-icon-background.png', 512, dict(bg='gradient', mark_scale=1.0, rounded=False, mark=False)),
        ('android-icon-foreground.png', 1024, dict(bg=None, mark_scale=1.0, rounded=False, transparent_bg=True)),
        # Themed (monochrome) icon + notification glyph: white M on transparent.
        ('android-icon-monochrome.png', 1024, dict(bg=None, mark_scale=1.0, rounded=False, transparent_bg=True)),
        # Splash: the rounded brand tile on a transparent canvas (splash background colour is set in app.config).
        ('splash-icon.png', 512, dict(bg='gradient', mark_scale=1.0, rounded=True)),
        ('favicon.png', 48, dict(bg='gradient', mark_scale=1.0, rounded=True)),
    ]
    for name, size, opts in jobs:
        write_png(os.path.join(OUT, name), size, size, render(size, **opts))
        print('wrote', name, size)


if __name__ == '__main__':
    main()
