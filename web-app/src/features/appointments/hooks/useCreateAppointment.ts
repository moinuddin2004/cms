import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAppointment } from '../services/appointments.api'
import { APPOINTMENTS_QUERY_KEY } from './useAppointments'
import { QUEUE_KEY } from '@/features/queue'

export function useCreateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
      queryClient.invalidateQueries({ queryKey: [QUEUE_KEY] })
    },
  })
}
