import { hexToOklch, oklchToHex } from './color'
import type { DarkBase } from '../types'

/**
 * Dark mode base palettes: the page, cards, borders, sidebar and grey text
 * behind the brand colour. Each preset is one hue + chroma laid over a
 * lightness ladder, so every surface keeps the same cast.
 */

interface Ladder {
  background: number
  surface: number
  /** Hover / selected rows. */
  accent: number
  /** Secondary buttons, nested panels. */
  raised: number
  border: number
  sidebar: number
  sidebarBorder: number
}

const STANDARD: Ladder = {
  background: 0.18,
  surface: 0.225,
  accent: 0.26,
  raised: 0.29,
  border: 0.3,
  sidebar: 0.155,
  sidebarBorder: 0.24,
}

interface Preset {
  /** `brand` takes the hue (and a little of the chroma) of the brand colour. */
  hue: number | 'brand'
  chroma: number
  ladder: Ladder
}

const PRESETS: Record<DarkBase, Preset> = {
  tinted: { hue: 'brand', chroma: 0.016, ladder: STANDARD },
  graphite: { hue: 0, chroma: 0, ladder: STANDARD },
  // The original slate look.
  midnight: {
    hue: 262,
    chroma: 0.04,
    ladder: {
      background: 0.208,
      surface: 0.279,
      accent: 0.279,
      raised: 0.372,
      border: 0.32,
      sidebar: 0.17,
      sidebarBorder: 0.279,
    },
  },
  stone: { hue: 55, chroma: 0.009, ladder: STANDARD },
  black: {
    hue: 0,
    chroma: 0,
    ladder: {
      background: 0,
      surface: 0.18,
      accent: 0.23,
      raised: 0.26,
      border: 0.27,
      sidebar: 0,
      sidebarBorder: 0.22,
    },
  },
}

export interface DarkBaseTokens {
  background: string
  surface: string
  accent: string
  raised: string
  border: string
  sidebar: string
  sidebarBorder: string
  text: string
  text2: string
  text3: string
}

/** The base palette of `preset`; `tinted` follows `brandColor`. */
export function deriveDarkBase(
  preset: DarkBase,
  brandColor: string,
): DarkBaseTokens {
  const p = PRESETS[preset]
  let h = 0
  let c = p.chroma
  if (p.hue === 'brand') {
    const brand = hexToOklch(brandColor)
    h = brand.h
    // A grey brand gets a grey base.
    c = Math.min(brand.c * 0.12, p.chroma)
  } else {
    h = p.hue
  }
  const at = (l: number, chroma = c) => oklchToHex({ l, c: chroma, h })
  const textC = c * 0.6
  const l = p.ladder
  return {
    background: at(l.background),
    surface: at(l.surface),
    accent: at(l.accent),
    raised: at(l.raised),
    border: at(l.border),
    sidebar: at(l.sidebar),
    sidebarBorder: at(l.sidebarBorder),
    text: at(0.965, textC),
    text2: at(0.86, textC),
    text3: at(0.715, textC),
  }
}

/** CSS custom properties for a `.dark` block. */
export function darkBaseVars(t: DarkBaseTokens): string[] {
  return [
    `--background: ${t.background};`,
    `--surface: ${t.surface};`,
    `--panel: ${t.surface};`,
    `--panel-2: ${t.raised};`,
    `--card: ${t.surface};`,
    `--popover: ${t.surface};`,
    `--muted: ${t.surface};`,
    `--secondary: ${t.raised};`,
    `--accent: ${t.accent};`,
    `--border: ${t.border};`,
    `--input: ${t.border};`,
    `--border-soft: ${t.surface};`,
    `--text: ${t.text};`,
    `--text-2: ${t.text2};`,
    `--text-3: ${t.text3};`,
    `--foreground: ${t.text};`,
    `--card-foreground: ${t.text};`,
    `--popover-foreground: ${t.text};`,
    `--secondary-foreground: ${t.text};`,
    `--accent-foreground: ${t.text};`,
    `--muted-foreground: ${t.text3};`,
    `--sidebar: ${t.sidebar};`,
    `--sidebar-foreground: ${t.text2};`,
    `--sidebar-border: ${t.sidebarBorder};`,
  ]
}

/** Read by the dark sidebar style, which also shows in light mode. */
export function darkSidebarVars(t: DarkBaseTokens): string[] {
  return [
    `--base-sidebar: ${t.sidebar};`,
    `--base-sidebar-border: ${t.sidebarBorder};`,
    `--base-sidebar-panel: ${t.surface};`,
  ]
}
