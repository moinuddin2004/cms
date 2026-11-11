/**
 * `GET /theme` payload (docs/07 §1). The settings registry returns these keys
 * without the `theme.` prefix and in snake_case, so the type mirrors the wire
 * format exactly — no field is renamed or invented (docs/04 §1).
 */

export type ThemeDefaultMode = 'light' | 'dark' | 'system';
export type ThemeSidebarStyle = 'light' | 'dark' | 'brand';
export type ThemeDarkBase = 'tinted' | 'graphite' | 'midnight' | 'stone' | 'black';

/** The resolved clinic theme for the active org + location. */
export interface ClinicTheme {
  app_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  /** `#rrggbb`; the source of the staff primary colour. */
  brand_color: string;
  sidebar_style: ThemeSidebarStyle;
  /** Staff screens follow the system unless the clinic forces a mode (docs/05 §11). */
  default_mode: ThemeDefaultMode;
  dark_base: ThemeDarkBase;
}
