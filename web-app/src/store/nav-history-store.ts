import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface NavHistoryEntry {
  pathname: string
  /** Page title, set by pages that know it (DashboardLayout, custom headers). */
  title?: string
}

interface NavHistoryState {
  /** Pages visited in this tab, keyed by the router's history index. */
  entries: Partial<Record<number, NavHistoryEntry>>
  record: (index: number, pathname: string) => void
  setTitle: (index: number, pathname: string, title: string) => void
}

/**
 * In-app page history for the ← back button: where the user came from and
 * what that page was called. Session storage = per tab, survives a refresh
 * (the browser keeps the history index too).
 */
export const useNavHistoryStore = create<NavHistoryState>()(
  persist(
    (set) => ({
      entries: {},
      record: (index, pathname) =>
        set((s) => {
          const prev = s.entries[index]
          if (prev?.pathname === pathname) return s
          return { entries: { ...s.entries, [index]: { pathname } } }
        }),
      // A page's effect runs before the root's `record`, so this may create it.
      setTitle: (index, pathname, title) =>
        set((s) => {
          const prev = s.entries[index]
          if (prev?.pathname === pathname && prev.title === title) return s
          return { entries: { ...s.entries, [index]: { pathname, title } } }
        }),
    }),
    {
      name: 'nav-history',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
