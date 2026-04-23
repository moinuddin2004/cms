import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'table' | 'card'

interface EmployeeState {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

export const useEmployeeStore = create<EmployeeState>()(
  persist(
    (set) => ({
      viewMode: 'table',
      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: 'employee-store',
    },
  ),
)
