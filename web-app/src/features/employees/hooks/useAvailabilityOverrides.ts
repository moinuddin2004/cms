import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import {
  fetchOverrides,
  createOverride,
  updateOverride,
  deleteOverride,
} from '../services/availability.api'
import type { OverrideFormData } from '../types'

export const OVERRIDES_QUERY_KEY = 'availability-overrides'

export function useAvailabilityOverrides(
  employeeId: string,
  params: { from?: string; to?: string } = {},
) {
  const { activeLocationId } = useAuthStore()

  return useQuery({
    queryKey: [OVERRIDES_QUERY_KEY, employeeId, activeLocationId, params],
    queryFn: () => fetchOverrides(employeeId, params),
    enabled: !!employeeId && !!activeLocationId,
    staleTime: 60 * 1000,
  })
}

export function useCreateOverride(employeeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: OverrideFormData) =>
      createOverride(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OVERRIDES_QUERY_KEY] })
      toast.success('Availability override created')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create override')
    },
  })
}

export function useUpdateOverride(employeeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<OverrideFormData>
    }) => updateOverride(employeeId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OVERRIDES_QUERY_KEY] })
      toast.success('Availability override updated')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update override')
    },
  })
}

export function useDeleteOverride(employeeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteOverride(employeeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OVERRIDES_QUERY_KEY] })
      toast.success('Availability override deleted')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete override')
    },
  })
}
