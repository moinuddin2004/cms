import { Uniwind } from 'uniwind';

/** `system` follows the phone; `light`/`dark` force a mode. */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Force light/dark, or hand control back to the phone with `'system'`
 * (docs/02 §10: staff orgs may force `theme.default_mode`). Anything that is
 * not a known mode — e.g. a stale cached value — reads as `'system'`.
 */
export function applyThemeMode(mode: ThemeMode | null | undefined): void {
  Uniwind.setTheme(mode === 'light' || mode === 'dark' ? mode : 'system');
}
