import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createWalkIn } from '../services/appointments.api'
import type { WalkInFormData } from '../types'
import { APPOINTMENTS_QUERY_KEY } from './useAppointments'
import { QUEUE_QUERY_KEY } from './useQueue'

export function useCreateWalkIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: WalkInFormData) => createWalkIn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUEUE_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
    },
  })
}
