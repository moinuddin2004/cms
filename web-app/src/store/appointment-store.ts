import { create } from 'zustand'

interface AppointmentUIState {
  // Calendar state
  selectedDate: Date
  setSelectedDate: (date: Date) => void

  // Modal state
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  selectedAppointmentId: string | null
  prefillDoctorId: string | null
  prefillTime: string | null

  openCreateModal: (doctorId?: string, time?: string) => void
  openEditModal: (id: string) => void
  closeModal: () => void
}

export const useAppointmentStore = create<AppointmentUIState>()((set) => ({
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  isCreateModalOpen: false,
  isEditModalOpen: false,
  selectedAppointmentId: null,
  prefillDoctorId: null,
  prefillTime: null,

  openCreateModal: (doctorId, time) =>
    set({
      isCreateModalOpen: true,
      isEditModalOpen: false,
      selectedAppointmentId: null,
      prefillDoctorId: doctorId || null,
      prefillTime: time || null,
    }),

  openEditModal: (id) =>
    set({
      isEditModalOpen: true,
      isCreateModalOpen: false,
      selectedAppointmentId: id,
      prefillDoctorId: null,
      prefillTime: null,
    }),

  closeModal: () =>
    set({
      isCreateModalOpen: false,
      isEditModalOpen: false,
      selectedAppointmentId: null,
      prefillDoctorId: null,
      prefillTime: null,
    }),
}))
