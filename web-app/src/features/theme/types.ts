export type SidebarStyle = 'light' | 'dark' | 'brand'
export type DefaultMode = 'light' | 'dark' | 'system'
export type DarkBase = 'tinted' | 'graphite' | 'midnight' | 'stone' | 'black'

/** The resolved theme for a tenant (`GET /theme`, `GET /public/theme/:orgId`). */
export interface ClinicTheme {
  app_name: string
  logo_url: string | null
  logo_dark_url: string | null
  favicon_url: string | null
  brand_color: string
  sidebar_style: SidebarStyle
  default_mode: DefaultMode
  dark_base: DarkBase
}

export type ThemeKey = keyof ClinicTheme

export const DEFAULT_THEME: ClinicTheme = {
  app_name: 'Clinic Portal',
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  brand_color: '#2563eb',
  sidebar_style: 'light',
  default_mode: 'system',
  dark_base: 'tinted',
}

interface ScopeCell {
  value: unknown
  locked: boolean
}

/** One key on an admin screen (`/admin/theme`, `/platform/theme`). */
export interface ThemeKeyView {
  key: ThemeKey
  scopes: ('org' | 'location')[]
  lockable: boolean
  default: unknown
  platform: ScopeCell
  org?: ScopeCell
  location?: ScopeCell
  /** What applies at the scope being edited. */
  effective: unknown
  /** What applies when this scope sets nothing. */
  inherited: unknown
  /** Locked by a scope above — read-only here. */
  lockedAbove: boolean
}

/** `null` clears a value (inherit from above). */
export interface ThemeUpdate {
  values?: Partial<Record<ThemeKey, string | null>>
  locks?: Partial<Record<ThemeKey, boolean>>
}

export const SIDEBAR_STYLE_LABEL: Record<SidebarStyle, string> = {
  light: 'Light',
  dark: 'Dark',
  brand: 'Brand colour',
}

export const DEFAULT_MODE_LABEL: Record<DefaultMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Follow device',
}

/** Dark mode base presets, in picker order. */
export const DARK_BASE_OPTIONS: {
  value: DarkBase
  label: string
  description: string
}[] = [
  {
    value: 'tinted',
    label: 'Brand tint',
    description: 'Greys with a hint of your brand colour',
  },
  {
    value: 'graphite',
    label: 'Graphite',
    description: 'Pure grey, no colour cast',
  },
  { value: 'midnight', label: 'Midnight', description: 'Cool blue-grey' },
  { value: 'stone', label: 'Stone', description: 'Soft, warm grey' },
  {
    value: 'black',
    label: 'True black',
    description: 'Deepest black, best on OLED screens',
  },
]

export const THEME_KEY_LABEL: Record<ThemeKey, string> = {
  app_name: 'Clinic name',
  logo_url: 'Logo (light)',
  logo_dark_url: 'Logo (dark)',
  favicon_url: 'Browser tab icon',
  brand_color: 'Brand colour',
  sidebar_style: 'Sidebar style',
  default_mode: 'Default mode',
  dark_base: 'Dark mode base',
}
