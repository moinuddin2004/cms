import { create } from 'zustand'
import { DEFAULT_THEME } from '../types'
import type { ClinicTheme } from '../types'

interface ThemeState {
  theme: ClinicTheme
  isLoading: boolean
  setTheme: (theme: ClinicTheme, isLoading: boolean) => void
}

/** The clinic theme in effect, written by `<ThemeProvider />`. */
export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  isLoading: false,
  setTheme: (theme, isLoading) => set({ theme, isLoading }),
}))

/** The clinic theme in effect (the MedTrackr default until one loads). */
export function useClinicTheme() {
  const theme = useThemeStore((s) => s.theme)
  const isLoading = useThemeStore((s) => s.isLoading)
  return { theme, isLoading }
}
