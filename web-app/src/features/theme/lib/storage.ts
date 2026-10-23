import type { ClinicTheme } from '../types'

const LAST_ORG_KEY = 'medtrackr.lastOrgId'
const THEME_CACHE_KEY = 'medtrackr.themeCache'
/** Read by the root route's pre-paint script, so the loader is on-brand. */
export const THEME_CSS_CACHE_KEY = 'medtrackr.themeCss'

// Storage can be missing or throw (private mode, blocked site data, SSR).
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export const rememberOrgId = (id: string) => write(LAST_ORG_KEY, id)
export const lastOrgId = () => read(LAST_ORG_KEY)

/** Last applied theme, re-applied on load before the API answers. */
export function cachedTheme(): ClinicTheme | null {
  const raw = read(THEME_CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ClinicTheme
  } catch {
    return null
  }
}

export const cacheTheme = (theme: ClinicTheme) =>
  write(THEME_CACHE_KEY, JSON.stringify(theme))

/** Brand CSS of the cached theme, injected before first paint on the next load. */
export const cacheThemeCss = (css: string) => write(THEME_CSS_CACHE_KEY, css)

/** Org id for the pre-auth theme: `?org=` first, else the last org used here. */
export function preAuthOrgId(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('org')
    if (fromUrl && /^[0-9a-f-]{36}$/i.test(fromUrl)) return fromUrl
  } catch {
    // ignore
  }
  return lastOrgId()
}
