import { create } from 'zustand'

interface AppointmentUIState {
  // Calendar state
  selectedDate: Date
  setSelectedDate: (date: Date) => void

  // Modal state — three distinct surfaces:
  //   detail: read-only "doctor's view", default on row/event click
  //   create: new appointment form
  //   edit:   editing an existing appointment
  isDetailModalOpen: boolean
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  selectedAppointmentId: string | null
  prefillDoctorId: string | null
  prefillTime: string | null

  openDetailModal: (id: string) => void
  openCreateModal: (doctorId?: string, time?: string) => void
  openEditModal: (id: string) => void
  closeModal: () => void
}

export const useAppointmentStore = create<AppointmentUIState>()((set) => ({
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  isDetailModalOpen: false,
  isCreateModalOpen: false,
  isEditModalOpen: false,
  selectedAppointmentId: null,
  prefillDoctorId: null,
  prefillTime: null,

  openDetailModal: (id) =>
    set({
      isDetailModalOpen: true,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      selectedAppointmentId: id,
      prefillDoctorId: null,
      prefillTime: null,
    }),

  openCreateModal: (doctorId, time) =>
    set({
      isDetailModalOpen: false,
      isCreateModalOpen: true,
      isEditModalOpen: false,
      selectedAppointmentId: null,
      prefillDoctorId: doctorId || null,
      prefillTime: time || null,
    }),

  openEditModal: (id) =>
    set({
      isDetailModalOpen: false,
      isEditModalOpen: true,
      isCreateModalOpen: false,
      selectedAppointmentId: id,
      prefillDoctorId: null,
      prefillTime: null,
    }),

  closeModal: () =>
    set({
      isDetailModalOpen: false,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      selectedAppointmentId: null,
      prefillDoctorId: null,
      prefillTime: null,
    }),
}))
