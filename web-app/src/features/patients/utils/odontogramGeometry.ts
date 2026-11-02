/**
 * Geometry for the arch odontogram: each tooth is drawn from above (occlusal
 * view) in its own local frame — x along the arch, +y towards the cheek/lips
 * (buccal), −y towards the tongue/palate — then placed on a U-shaped arch.
 */
import { ARCHES, isAnterior, toothKind } from './teethChart'
import type { Dentition, Surface, ToothKind } from './teethChart'

export const ARCH_VIEWBOX = { x: 10, y: 0, w: 580, h: 425 }

export type ToothGeo = {
  x: number
  y: number
  /** Rotation in degrees that maps local +y onto the outward normal. */
  rotate: number
  /** Size on the arch. */
  w: number
  d: number
  /** Natural size (used by the enlarged detail view). */
  rawW: number
  rawD: number
  /** +1 when local +x points towards the midline (mesial), else −1. */
  mesialSign: number
  /** Outward unit normal, for placing the tooth number. */
  nx: number
  ny: number
}

/** Superellipse outline with per-kind cusps and a narrower lingual side. */
export function outlinePath(kind: ToothKind, w: number, d: number): string {
  const n = { molar: 3.2, premolar: 2.4, canine: 1.8, incisor: 2.6 }[kind]
  const taper = { incisor: 0.4, canine: 0.28, premolar: 0.15, molar: 0.05 }[
    kind
  ]
  let p = ''
  for (let j = 0; j < 72; j++) {
    const a = (2 * Math.PI * j) / 72
    const c = Math.cos(a)
    const s = Math.sin(a)
    let x = (Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * w) / 2
    let y = (Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * d) / 2
    // Four cusp lobes on molars.
    const m = kind === 'molar' ? 1 + 0.045 * Math.cos(4 * a - Math.PI) : 1
    x *= m
    y *= m
    if (s < 0) x *= 1 - taper * Math.abs(s)
    if (kind === 'incisor' && s > 0) y *= 0.75
    p += `${j ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return p + 'Z'
}

/** The occlusal table (back teeth) or incisal edge (front teeth). */
export function centerPath(tooth: number, w: number, d: number): string {
  if (!isAnterior(tooth))
    return outlinePath(toothKind(tooth), w * 0.5, d * 0.48)
  let p = ''
  for (let j = 0; j < 36; j++) {
    const a = (2 * Math.PI * j) / 36
    p += `${j ? 'L' : 'M'}${(Math.cos(a) * w * 0.3).toFixed(2)} ${(Math.sin(a) * d * 0.12).toFixed(2)}`
  }
  return p + 'Z'
}

export function groovePath(tooth: number, w: number, d: number): string {
  const kind = toothKind(tooth)
  if (kind === 'molar')
    return `M${-w * 0.18} 0 L${w * 0.18} 0 M0 ${-d * 0.16} L0 ${d * 0.16}`
  if (kind === 'premolar') return `M${-w * 0.16} 0 L${w * 0.16} 0`
  return ''
}

type Side = 'buccal' | 'lingual' | 'plusX' | 'minusX'

/** The four outer wedges; each is clipped to the tooth outline. */
export function sideWedges(w: number, d: number): [Side, string][] {
  const W = w * 1.6
  const D = d * 1.6
  const poly = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ')
  return [
    [
      'buccal',
      poly([
        [0, 0],
        [-W, D],
        [W, D],
      ]),
    ],
    [
      'lingual',
      poly([
        [0, 0],
        [-W, -D],
        [W, -D],
      ]),
    ],
    [
      'plusX',
      poly([
        [0, 0],
        [W, -D],
        [W, D],
      ]),
    ],
    [
      'minusX',
      poly([
        [0, 0],
        [-W, -D],
        [-W, D],
      ]),
    ],
  ]
}

export function sideSurface(side: Side, mesialSign: number): Surface {
  if (side === 'buccal') return 'B'
  if (side === 'lingual') return 'L'
  return (side === 'plusX') === mesialSign > 0 ? 'M' : 'D'
}

// Natural crown sizes (mesiodistal width, buccolingual depth) by position.
const SIZES: Record<
  Dentition,
  Record<'upper' | 'lower', { w: number[]; d: number[] }>
> = {
  permanent: {
    upper: {
      w: [0, 22, 17, 19, 17, 16, 25, 23, 21],
      d: [0, 14, 13, 18, 21, 20, 26, 25, 23],
    },
    lower: {
      w: [0, 13, 14, 16, 17, 17, 27, 25, 23],
      d: [0, 13, 13, 16, 18, 19, 24, 23, 21],
    },
  },
  primary: {
    upper: { w: [0, 17, 14, 15, 18, 22], d: [0, 12, 11, 15, 19, 21] },
    lower: { w: [0, 11, 12, 14, 19, 24], d: [0, 11, 11, 13, 17, 20] },
  },
}

// Ellipse arcs (centre, radii) per arch.
const ARCS: Record<
  Dentition,
  Record<'upper' | 'lower', { cy: number; rx: number; ry: number }>
> = {
  permanent: {
    upper: { cy: 200, rx: 200, ry: 170 },
    lower: { cy: 232, rx: 190, ry: 160 },
  },
  primary: {
    upper: { cy: 190, rx: 165, ry: 140 },
    lower: { cy: 242, rx: 155, ry: 130 },
  },
}

const CX = 300
const GAP = 3

/**
 * Space the teeth along the arc by their real widths (not by angle), so the
 * molars at the back aren't squeezed, then scale them to fill the arc.
 */
function layoutArch(
  teeth: number[],
  { cy, rx, ry }: { cy: number; rx: number; ry: number },
  dir: -1 | 1,
  sizes: { w: number[]; d: number[] },
  out: Record<number, ToothGeo>,
) {
  const th0 = 0.06 * Math.PI
  const N = 800
  const th: number[] = []
  const cum: number[] = [0]
  let prev: [number, number] | null = null
  for (let i = 0; i <= N; i++) {
    const T = Math.PI - th0 - ((Math.PI - 2 * th0) * i) / N
    const x = CX + rx * Math.cos(T)
    const y = cy + dir * ry * Math.sin(T)
    if (prev)
      cum.push(cum[cum.length - 1] + Math.hypot(x - prev[0], y - prev[1]))
    th.push(T)
    prev = [x, y]
  }
  const raw = teeth.map((t) => sizes.w[t % 10])
  const k = (cum[N] - teeth.length * GAP) / raw.reduce((a, b) => a + b, 0)
  let s = GAP / 2
  teeth.forEach((t, i) => {
    const w = raw[i] * k
    const d = sizes.d[t % 10] * k
    const centre = s + w / 2
    s += w + GAP
    let j = cum.findIndex((v) => v >= centre)
    if (j < 0) j = N
    const T = th[j]
    let nx = Math.cos(T) / rx
    let ny = (dir * Math.sin(T)) / ry
    const nl = Math.hypot(nx, ny)
    nx /= nl
    ny /= nl
    const phi = Math.atan2(-nx, ny)
    // Direction of travel towards the midline.
    const tx = rx * Math.sin(T)
    const ty = -dir * ry * Math.cos(T)
    const towardsMid = i < teeth.length / 2 ? 1 : -1
    const dot =
      Math.cos(phi) * tx * towardsMid + Math.sin(phi) * ty * towardsMid
    out[t] = {
      x: CX + rx * Math.cos(T),
      y: cy + dir * ry * Math.sin(T),
      rotate: (phi * 180) / Math.PI,
      w,
      d,
      rawW: raw[i],
      rawD: sizes.d[t % 10],
      mesialSign: Math.sign(dot) || 1,
      nx,
      ny,
    }
  })
}

function buildLayout(dentition: Dentition) {
  const out: Record<number, ToothGeo> = {}
  const arch = ARCHES[dentition]
  layoutArch(arch.upper, ARCS[dentition].upper, -1, SIZES[dentition].upper, out)
  layoutArch(arch.lower, ARCS[dentition].lower, 1, SIZES[dentition].lower, out)
  return out
}

export const ARCH_LAYOUT: Record<Dentition, Record<number, ToothGeo>> = {
  permanent: buildLayout('permanent'),
  primary: buildLayout('primary'),
}

/** Geometry for any FDI tooth, regardless of which arch is shown. */
export const toothGeo = (t: number): ToothGeo =>
  ARCH_LAYOUT.permanent[t] ?? ARCH_LAYOUT.primary[t]
