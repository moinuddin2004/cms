import { create } from 'zustand'

interface UIState {
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  /** Global date filter */
  dateFilter: string
  setDateFilter: (filter: string) => void

  /** Theme mode */
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  dateFilter: 'Last 7 days',
  setDateFilter: (filter) => set({ dateFilter: filter }),

  theme: 'light',
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  setTheme: (theme) => set({ theme }),
}))
