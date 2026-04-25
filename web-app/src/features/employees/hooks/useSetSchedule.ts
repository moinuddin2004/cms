import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setSchedule } from '../services/schedule.api'
import { SCHEDULE_QUERY_KEY } from './useEmployeeSchedule'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'

export function useSetSchedule(employeeId: string) {
  const { activeLocationId } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      slotDuration: number
      schedule: {
        dayOfWeek: number
        isWorking: boolean
        startTime?: string
        endTime?: string
      }[]
    }) => setSchedule(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_QUERY_KEY, employeeId, activeLocationId],
      })
      toast.success('Schedule saved successfully')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save schedule')
    },
  })
}
