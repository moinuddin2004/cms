import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateAppointment } from '../services/appointments.api'
import { APPOINTMENTS_QUERY_KEY } from './useAppointments'
import { QUEUE_KEY } from '@/features/queue'

export function useUpdateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, any>) =>
      updateAppointment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
      queryClient.invalidateQueries({ queryKey: [QUEUE_KEY] })
    },
  })
}
