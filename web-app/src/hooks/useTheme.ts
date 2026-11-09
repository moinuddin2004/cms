import { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'

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

let transitionTimer: number | undefined

/**
 * Run a theme change so the switch fades instead of flashing.
 * `change` must apply the new theme to the DOM synchronously (state updates
 * inside it are flushed), so the browser's "before" snapshot is still the
 * old theme.
 */
function withSmoothTransition(change: () => void) {
  const html = document.documentElement
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    change()
    return
  }
  // Best: the browser cross-fades a snapshot of the whole page.
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> }
  }
  if (typeof doc.startViewTransition === 'function') {
    // Element colour transitions (hover styles etc.) would keep animating
    // underneath the cross-fade; freeze them so it is one clean fade.
    html.classList.add('theme-switching')
    const vt = doc.startViewTransition(change)
    vt.finished.finally(() => html.classList.remove('theme-switching'))
    return
  }
  html.classList.add('theme-transition')
  change()
  window.clearTimeout(transitionTimer)
  transitionTimer = window.setTimeout(
    () => html.classList.remove('theme-transition'),
    350,
  )
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
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      // storage unavailable — the choice lasts for this page only
    }
    // The DOM change AND the React re-render (icons, labels) both happen
    // inside the transition — otherwise the mount effect below applies the
    // new theme before the "old" snapshot is taken and nothing fades.
    withSmoothTransition(() => {
      applyTheme(newTheme)
      flushSync(() => setThemeState(newTheme))
    })
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
