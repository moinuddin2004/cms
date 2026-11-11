import { Uniwind } from 'uniwind';

import { deriveBrandPalette, isHexColor } from './brand';
import { PLATFORM_BRAND_TOKENS, type BrandCSSVariables } from './platform-tokens';

/**
 * The staff space's runtime brand theme (docs/02 §10): the active clinic's
 * `theme.brand_color` becomes `primary` in both colour schemes, derived with
 * the same OKLCH math as the web app so the clinic looks identical on the
 * phone and in the browser.
 *
 * Only the three brand-owned variables are touched; every other token keeps
 * its `src/global.css` value. `applyBrand(null)` (no clinic / leaving the staff
 * space) restores the platform palette, so the welcome screen is never
 * branded (docs/10 M0-05 acceptance).
 */

/** Light and dark values for one brand colour. */
export function brandCSSVariables(hex: string): {
  light: BrandCSSVariables;
  dark: BrandCSSVariables;
} {
  const palette = deriveBrandPalette(hex);
  return {
    light: {
      '--color-primary': palette.light.brand,
      '--color-primary-foreground': palette.light.foreground,
      '--color-ring': palette.light.brand,
    },
    dark: {
      '--color-primary': palette.dark.brand,
      '--color-primary-foreground': palette.dark.foreground,
      '--color-ring': palette.dark.brand,
    },
  };
}

/**
 * Apply a clinic brand colour, or the platform palette for `null`.
 *
 * A malformed value (nothing else validates prefs) falls back to the platform
 * palette instead of throwing: a bad cached string must never break the app.
 * Both themes are written at once — `Uniwind.updateCSSVariables` stores them
 * per theme, so a light/dark switch keeps the right brand shades.
 */
export function applyBrand(hex: string | null): void {
  const vars = hex && isHexColor(hex) ? brandCSSVariables(hex) : PLATFORM_BRAND_TOKENS;

  Uniwind.updateCSSVariables('light', vars.light);
  Uniwind.updateCSSVariables('dark', vars.dark);
}
