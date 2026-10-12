import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchQueueMe } from '../services/queue.api'
import { QUEUE_KEY } from './useQueueData'

/**
 * What the signed-in user may do in the queue at the active location, from
 * the server's own role resolution. Used only to hide buttons the API would
 * refuse — the API still enforces every rule. While loading (or on error)
 * everything reports false, so restricted buttons never flash on screen.
 */
export function useQueueRole() {
  const locationId = useAuthStore((s) => s.activeLocationId)
  const { data, isLoading } = useQuery({
    queryKey: [QUEUE_KEY, 'me', locationId],
    queryFn: fetchQueueMe,
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const roles = data?.roles ?? []
  const isAdmin = roles.includes('clinic_admin')
  return {
    isLoading,
    employeeId: data?.employeeId ?? null,
    isAdmin,
    canReception: isAdmin || roles.includes('receptionist'),
    canDoctor: isAdmin || roles.includes('doctor'),
    /** Doctor actions on this doctor's queue (own queue, or admin). */
    isDoctorOf: (doctorId: string) =>
      isAdmin || (roles.includes('doctor') && data?.employeeId === doctorId),
  }
}
