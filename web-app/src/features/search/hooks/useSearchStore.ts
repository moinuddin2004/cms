import { create } from 'zustand'

interface SearchState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

/** Open/closed state of the global quick search palette (Ctrl+K). */
export const useSearchStore = create<SearchState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
