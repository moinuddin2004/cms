import { setDefaultThemeMode } from '@/hooks/useTheme'
import { DEFAULT_THEME } from '../types'
import type { ClinicTheme, DarkBase } from '../types'
import { deriveBrandPalette, RAMP_STEPS } from './color'
import type { BrandTokens } from './color'
import { darkBaseVars, darkSidebarVars, deriveDarkBase } from './dark-base'

const STYLE_ID = 'clinic-theme'

function tokens(t: BrandTokens): string[] {
  return [
    `--brand: ${t.brand};`,
    `--brand-hover: ${t.hover};`,
    `--brand-soft: ${t.soft};`,
    `--brand-text: ${t.text};`,
    `--primary-foreground: ${t.foreground};`,
    `--sidebar-primary-foreground: ${t.foreground};`,
    `--ring-soft: ${t.ringSoft};`,
    // Re-declared so a scoped block (the preview) re-resolves them; at :root
    // they repeat styles.css.
    '--primary: var(--brand);',
    '--ring: var(--brand);',
    '--primary-hover: var(--brand-hover);',
    '--primary-soft: var(--brand-soft);',
    '--primary-text: var(--brand-text);',
    '--sidebar-primary: var(--brand);',
    '--sidebar-ring: var(--brand);',
    '--sidebar-accent: var(--brand-soft);',
    '--sidebar-accent-foreground: var(--brand-text);',
  ]
}

/**
 * CSS overriding the brand seed and dark base in styles.css for light
 * (`:root`) and dark (`.dark`). Injected after the stylesheet, so equal
 * specificity wins. The theme builder's preview passes its own scoped
 * selectors.
 */
export function buildThemeCss(
  brandColor: string,
  darkBase: DarkBase = DEFAULT_THEME.dark_base,
  selectors: { light: string; dark: string } = {
    light: ':root',
    dark: '.dark',
  },
): string {
  const p = deriveBrandPalette(brandColor)
  const base = deriveDarkBase(darkBase, brandColor)
  const ramp = RAMP_STEPS.map((s) => `--brand-${s}: ${p.ramp[s]};`)
  const block = (selector: string, lines: string[]) =>
    `${selector} {\n  ${lines.join('\n  ')}\n}`
  return [
    block(selectors.light, [
      ...tokens(p.light),
      ...ramp,
      `--chart-1: ${p.light.brand};`,
      ...darkSidebarVars(base),
    ]),
    block(selectors.dark, [
      ...tokens(p.dark),
      `--chart-1: ${p.dark.brand};`,
      ...darkBaseVars(base),
      ...darkSidebarVars(base),
    ]),
  ].join('\n')
}

function setFavicon(doc: Document, url: string | null) {
  doc.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    if (link.dataset.defaultHref === undefined) {
      link.dataset.defaultHref = link.getAttribute('href') ?? ''
      link.dataset.defaultType = link.getAttribute('type') ?? ''
    }
    if (url) {
      link.setAttribute('href', url)
      link.removeAttribute('type')
    } else {
      link.setAttribute('href', link.dataset.defaultHref)
      if (link.dataset.defaultType) {
        link.setAttribute('type', link.dataset.defaultType)
      }
    }
  })
}

/** Apply a clinic theme to the document: brand tokens, sidebar, title, icon, mode. */
export function applyClinicTheme(theme: ClinicTheme, doc: Document = document) {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = STYLE_ID
    doc.head.appendChild(style)
  }
  try {
    style.textContent = buildThemeCss(theme.brand_color, theme.dark_base)
  } catch {
    style.textContent = '' // invalid colour: keep the stylesheet defaults
  }

  doc.documentElement.dataset.sidebarStyle = theme.sidebar_style
  doc.title = theme.app_name
  setFavicon(doc, theme.favicon_url)
  setDefaultThemeMode(theme.default_mode)
}
