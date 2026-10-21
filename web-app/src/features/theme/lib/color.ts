/**
 * Brand colour math: OKLCH for deriving shades (perceptually even, so a
 * "lighter" teal and a "lighter" blue look equally lighter) and WCAG 2.x
 * relative luminance for contrast.
 */

export interface Oklch {
  l: number
  c: number
  h: number
}

const HEX_RE = /^#[0-9a-f]{6}$/i

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value)
}

function hexToRgb(hex: string): [number, number, number] {
  if (!isHexColor(hex)) throw new Error(`Not a #rrggbb colour: ${hex}`)
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ]
}

function rgbToHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

const toLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
const fromLinear = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const h = (Math.atan2(B, A) * 180) / Math.PI
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h }
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180
  const A = c * Math.cos(rad)
  const B = c * Math.sin(rad)
  const l_ = Math.pow(l + 0.3963377774 * A + 0.2158037573 * B, 3)
  const m_ = Math.pow(l - 0.1055613458 * A - 0.0638541728 * B, 3)
  const s_ = Math.pow(l - 0.0894841775 * A - 1.291485548 * B, 3)
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/** OKLCH → hex, lowering chroma (keeping lightness + hue) until it fits sRGB. */
export function oklchToHex(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l))
  let lo = 0
  let hi = color.c
  if (!inGamut(oklchToLinear({ ...color, l }))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinear({ ...color, l, c: mid }))) lo = mid
      else hi = mid
    }
    hi = lo
  }
  const rgb = oklchToLinear({ ...color, l, c: hi }).map(fromLinear)
  return rgbToHex(rgb as [number, number, number])
}

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** White or black — whichever reads better on `background`. */
export function readableForeground(background: string): '#ffffff' | '#000000' {
  return contrastRatio(background, '#ffffff') >=
    contrastRatio(background, '#000000')
    ? '#ffffff'
    : '#000000'
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Darken (or lighten) in OKLCH until `color` reaches `ratio` against `against`. */
function untilContrast(
  color: Oklch,
  against: string,
  ratio: number,
  step: number,
): string {
  let c = { ...color }
  let hex = oklchToHex(c)
  for (let i = 0; i < 100 && contrastRatio(hex, against) < ratio; i++) {
    c = { ...c, l: Math.min(1, Math.max(0, c.l + step)) }
    hex = oklchToHex(c)
  }
  return hex
}

export interface BrandTokens {
  brand: string
  hover: string
  soft: string
  text: string
  /** Text/icon colour on `brand` (shadcn `--primary-foreground`). */
  foreground: string
  ringSoft: string
}

export const RAMP_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900,
] as const

// Lightness and relative chroma per ramp step (close to Tailwind's blue).
const RAMP_L = [
  0.97, 0.932, 0.882, 0.809, 0.714, 0.623, 0.546, 0.488, 0.424, 0.379,
]
const RAMP_C = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 1, 0.95, 0.8, 0.65]

export interface BrandPalette {
  light: BrandTokens
  dark: BrandTokens
  ramp: Record<(typeof RAMP_STEPS)[number], string>
}

const DARK_BACKGROUND = '#0f172a'

/** Every brand token for light and dark mode from one brand colour. */
export function deriveBrandPalette(hex: string): BrandPalette {
  const base = hexToOklch(hex)
  const brand = hex.toLowerCase()

  const light: BrandTokens = {
    brand,
    hover: oklchToHex({
      ...base,
      l: base.l > 0.35 ? base.l - 0.07 : base.l + 0.07,
    }),
    soft: oklchToHex({ ...base, l: 0.97, c: Math.min(base.c * 0.12, 0.03) }),
    text: untilContrast(base, '#ffffff', 4.5, -0.02),
    foreground: readableForeground(brand),
    ringSoft: withAlpha(brand, 0.35),
  }

  // Dark mode: lift dark brands so they stand out on the slate background.
  const darkBase = { ...base, l: Math.max(base.l, 0.62) }
  const darkBrand = oklchToHex(darkBase)
  const dark: BrandTokens = {
    brand: darkBrand,
    hover: oklchToHex({ ...darkBase, l: Math.min(darkBase.l + 0.07, 0.95) }),
    soft: withAlpha(darkBrand, 0.16),
    text: untilContrast(
      { ...darkBase, l: Math.max(darkBase.l, 0.8), c: darkBase.c * 0.7 },
      DARK_BACKGROUND,
      4.5,
      0.02,
    ),
    foreground: readableForeground(darkBrand),
    ringSoft: withAlpha(darkBrand, 0.4),
  }

  const ramp = Object.fromEntries(
    RAMP_STEPS.map((step, i) => [
      step,
      oklchToHex({ l: RAMP_L[i], c: base.c * RAMP_C[i], h: base.h }),
    ]),
  ) as BrandPalette['ramp']

  return { light, dark, ramp }
}

export interface ContrastCheck {
  /** Contrast of the button text (white/black) on the brand colour. */
  buttonRatio: number
  /** Contrast of the brand colour as text/links on a white page. */
  onWhiteRatio: number
  warnings: string[]
}

/** WCAG AA checks shown next to the colour picker. */
export function checkBrandContrast(hex: string): ContrastCheck {
  const buttonRatio = contrastRatio(hex, readableForeground(hex))
  const onWhiteRatio = contrastRatio(hex, '#ffffff')
  const warnings: string[] = []
  if (buttonRatio < 4.5) {
    warnings.push(
      `Button text has ${buttonRatio.toFixed(1)}:1 contrast — below the 4.5:1 AA minimum.`,
    )
  }
  if (onWhiteRatio < 3) {
    warnings.push(
      `This colour is very light (${onWhiteRatio.toFixed(1)}:1 on white). Links and outlines will be hard to see; a darker shade is used for brand text.`,
    )
  }
  return { buttonRatio, onWhiteRatio, warnings }
}
