/**
 * The platform (no clinic) brand tokens: the `--color-primary`,
 * `--color-primary-foreground` and `--color-ring` values written in
 * `src/global.css`. `applyBrand(null)` restores exactly these, and the tokens
 * test (`platform-tokens.test.ts`) keeps this file and the stylesheet in sync —
 * they cannot import each other.
 *
 * The primary is the OKLCH-derived teal-blue of `#0e7490` (docs/10 M0-05 step 1):
 * light = the seed itself (5.36:1 on white); dark = the seed lifted to OKLCH
 * lightness 0.62 like the web's dark brand, which reads better on the dark
 * background with a black foreground (5.91:1).
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
    '--color-primary': '#0e7490',
    '--color-primary-foreground': '#ffffff',
    // Matches the neutral `--color-ring` in global.css.
    '--color-ring': 'hsl(0 0% 63%)',
  },
  dark: {
    '--color-primary': '#3a92af',
    '--color-primary-foreground': '#000000',
    '--color-ring': 'hsl(300 0% 45%)',
  },
};
