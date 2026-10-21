import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

// The clinic's default mode (theme.default_mode), used while the user has
// no saved preference of their own. Set by the ThemeProvider.
let defaultMode: Theme = 'system'
const defaultModeListeners = new Set<() => void>()

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // storage unavailable
  }
  return null
}

function getStoredTheme(): Theme {
  return readStoredTheme() ?? defaultMode
}

/** The clinic default; applies only to users without a saved preference. */
export function setDefaultThemeMode(mode: Theme) {
  if (mode === defaultMode) return
  defaultMode = mode
  defaultModeListeners.forEach((l) => l())
}

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemPreference() : theme
  const html = document.documentElement

  if (resolved === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }

  // Set a data attribute for CSS selectors that may need it
  html.setAttribute('data-theme', resolved)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      // storage unavailable — the choice lasts for this page only
    }
    applyTheme(newTheme)
  }, [])

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the clinic default while the user has no saved preference
  useEffect(() => {
    const onDefault = () => {
      if (!readStoredTheme()) setThemeState(defaultMode)
    }
    defaultModeListeners.add(onDefault)
    onDefault()
    return () => {
      defaultModeListeners.delete(onDefault)
    }
  }, [])

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system')

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const newTheme = readStoredTheme() ?? defaultMode
        setThemeState(newTheme)
        applyTheme(newTheme)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return { theme, setTheme } as const
}
