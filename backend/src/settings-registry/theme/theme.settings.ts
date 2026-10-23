import { ConfigScope } from '../entities/config-value.entity';
import { defineSetting, s } from '../setting-definition';

const { ORG, LOCATION } = ConfigScope;

/**
 * Theme keys (design doc, decision 6: logo, name, brand colour, sidebar
 * style and default mode only — no font, radius or density).
 */
export const THEME_SETTINGS = {
  appName: defineSetting('theme.app_name', {
    schema: s.string({ min: 1, max: 60 }),
    default: 'Clinic Portal',
    scopes: [ORG, LOCATION],
    lockable: true,
  }),
  logoUrl: defineSetting<string>('theme.logo_url', {
    schema: s.url(),
    default: null,
    scopes: [ORG, LOCATION],
    lockable: true,
  }),
  logoDarkUrl: defineSetting<string>('theme.logo_dark_url', {
    schema: s.url(),
    default: null,
    scopes: [ORG, LOCATION],
    lockable: true,
  }),
  faviconUrl: defineSetting<string>('theme.favicon_url', {
    schema: s.url(),
    default: null,
    scopes: [ORG],
    lockable: true,
  }),
  brandColor: defineSetting('theme.brand_color', {
    schema: s.hexColor(),
    default: '#2563eb',
    scopes: [ORG],
    lockable: true,
  }),
  sidebarStyle: defineSetting('theme.sidebar_style', {
    schema: s.oneOf(['light', 'dark', 'brand'] as const),
    default: 'light',
    scopes: [ORG],
    lockable: true,
  }),
  defaultMode: defineSetting('theme.default_mode', {
    schema: s.oneOf(['light', 'dark', 'system'] as const),
    default: 'system',
    scopes: [ORG],
    lockable: true,
  }),
};

export const THEME_KEYS = Object.values(THEME_SETTINGS).map((d) => d.key);

/** The resolved theme, keyed without the `theme.` prefix. */
export interface ResolvedTheme {
  app_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  brand_color: string;
  sidebar_style: 'light' | 'dark' | 'brand';
  default_mode: 'light' | 'dark' | 'system';
}

export const shortThemeKey = (key: string) => key.replace(/^theme\./, '');
