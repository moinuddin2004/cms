import type { ClinicTheme } from '../types'

const LAST_ORG_KEY = 'medtrackr.lastOrgId'
const THEME_CACHE_KEY = 'medtrackr.themeCache'

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
