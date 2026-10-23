import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { accessKeys } from '@/features/access'
import type { NavLayout } from '@/features/access'
import { navBuilderApi } from '../services/nav-builder.api'

export const navLayoutKeys = {
  clinic: (orgId: string | null) => ['nav-layout', orgId] as const,
}

const errorMessage = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

export function useClinicNavLayout(orgId: string | null) {
  return useQuery({
    queryKey: navLayoutKeys.clinic(orgId),
    queryFn: navBuilderApi.get,
    enabled: !!orgId,
  })
}

/** Writes change `/me/access.nav`: refresh the sidebar right away. */
function useNavMutation<TInput, TResult>(
  orgId: string | null,
  fn: (input: TInput) => Promise<TResult>,
  success: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      toast.success(success)
      await Promise.all([
        qc.invalidateQueries({ queryKey: navLayoutKeys.clinic(orgId) }),
        qc.invalidateQueries({ queryKey: accessKeys.org(orgId) }),
      ])
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not save the sidebar')),
  })
}

export const useSaveNavLayout = (orgId: string | null) =>
  useNavMutation(
    orgId,
    (layout: NavLayout) => navBuilderApi.save(layout),
    'Sidebar saved',
  )

export const useResetNavLayout = (orgId: string | null) =>
  useNavMutation(orgId, () => navBuilderApi.reset(), 'Sidebar reset to default')
