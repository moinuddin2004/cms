import { create } from 'zustand'
import type { FeatureFilters } from '../types/feature-settings.types'
import { DEFAULT_FEATURE_FILTERS } from '../lib/filter-features'

interface FeatureSettingsState {
  filters: FeatureFilters
  setFilters: (patch: Partial<FeatureFilters>) => void
  clearFilters: () => void
  /** Feature whose "turn off" confirm dialog is open. */
  confirmOffKey: string | null
  setConfirmOffKey: (key: string | null) => void
  /** Feature whose per-location sheet is open. */
  locationsKey: string | null
  setLocationsKey: (key: string | null) => void
}

/** UI state of the owner's Features page. */
export const useFeatureSettingsStore = create<FeatureSettingsState>((set) => ({
  filters: DEFAULT_FEATURE_FILTERS,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  clearFilters: () => set({ filters: DEFAULT_FEATURE_FILTERS }),
  confirmOffKey: null,
  setConfirmOffKey: (confirmOffKey) => set({ confirmOffKey }),
  locationsKey: null,
  setLocationsKey: (locationsKey) => set({ locationsKey }),
}))
