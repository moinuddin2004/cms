import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  cancelAppointment,
  markNoShow,
  confirmAppointment,
} from '../services/appointments.api'
import type { CancelReason } from '../types'
import { APPOINTMENTS_QUERY_KEY } from './useAppointments'
import { QUEUE_KEY } from '@/features/queue'

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
  queryClient.invalidateQueries({ queryKey: [QUEUE_KEY] })
  queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
  queryClient.invalidateQueries({ queryKey: ['appointment-detail'] })
}

function useStatusMutation(
  mutationFn: (id: string, ...args: any[]) => Promise<any>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateAll(queryClient),
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      reasonCode,
      reason,
    }: {
      id: string
      reasonCode?: CancelReason
      reason?: string
    }) => cancelAppointment(id, { reasonCode, reason }),
    onSuccess: () => invalidateAll(queryClient),
  })
}

export function useNoShow() {
  return useStatusMutation(markNoShow)
}

export function useConfirmAppointment() {
  return useStatusMutation(confirmAppointment)
}
