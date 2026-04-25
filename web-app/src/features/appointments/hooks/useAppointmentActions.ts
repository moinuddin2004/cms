import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  cancelAppointment,
  markNoShow,
  checkInAppointment,
  completeAppointment,
  confirmAppointment,
} from '../services/appointments.api'
import { APPOINTMENTS_QUERY_KEY } from './useAppointments'

function useStatusMutation(mutationFn: (id: string, ...args: any[]) => Promise<any>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
    },
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelAppointment(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
    },
  })
}

export function useNoShow() {
  return useStatusMutation(markNoShow)
}

export function useCheckIn() {
  return useStatusMutation(checkInAppointment)
}

export function useCompleteAppointment() {
  return useStatusMutation(completeAppointment)
}

export function useConfirmAppointment() {
  return useStatusMutation(confirmAppointment)
}
