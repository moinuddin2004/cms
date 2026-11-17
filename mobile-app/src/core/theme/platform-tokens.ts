/**
 * The platform (no clinic) brand tokens: the `--color-primary`,
 * `--color-primary-foreground` and `--color-ring` values written in
 * `src/global.css`. `applyBrand(null)` restores exactly these, and the tokens
 * test (`platform-tokens.test.ts`) keeps this file and the stylesheet in sync —
 * they cannot import each other.
 *
 * The primary is the MedTrackr blue `#2563eb` (A-25, the web app's `--brand`;
 * UI-01 replaced the earlier teal `#0e7490`): light = the colour itself
 * (5.17:1 on white); dark = `deriveBrandPalette('#2563eb').dark.brand`, i.e.
 * exactly what the staff space shows for a clinic on the default web brand
 * (5.9:1 with a black foreground). The ring follows the primary, like the web.
 */

/** The three brand-owned CSS variables, per theme. */
export interface BrandCSSVariables {
  /** Lets Uniwind's `CSSVariables` (`Record<string, string | number>`) accept it. */
  [variable: string]: string;
  '--color-primary': string;
  '--color-primary-foreground': string;
  '--color-ring': string;
}

export const PLATFORM_BRAND_TOKENS: { light: BrandCSSVariables; dark: BrandCSSVariables } = {
  light: {
    '--color-primary': '#2563eb',
    '--color-primary-foreground': '#ffffff',
    '--color-ring': '#2563eb',
  },
  dark: {
    '--color-primary': '#3f7dff',
    '--color-primary-foreground': '#000000',
    '--color-ring': '#3f7dff',
  },
};
