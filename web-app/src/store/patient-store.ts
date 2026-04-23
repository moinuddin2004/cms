import { create } from 'zustand'
import type { PatientFormData } from '@/features/patients/types'

export type ViewMode = 'card' | 'table'

interface PatientStoreState {
  /** Card or table view toggle */
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void

  /** Multi-step form draft (auto-save) */
  formDraft: Partial<PatientFormData> | null
  setFormDraft: (draft: Partial<PatientFormData>) => void
  clearFormDraft: () => void

  /** Current form step index */
  currentStep: number
  setCurrentStep: (step: number) => void
}

export const usePatientStore = create<PatientStoreState>((set) => ({
  viewMode: 'table',
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'table' ? 'card' : 'table',
    })),

  formDraft: null,
  setFormDraft: (draft) =>
    set((state) => ({
      formDraft: { ...state.formDraft, ...draft },
    })),
  clearFormDraft: () => set({ formDraft: null, currentStep: 0 }),

  currentStep: 0,
  setCurrentStep: (step) => set({ currentStep: step }),
}))
