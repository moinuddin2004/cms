import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPlanTemplate,
  deletePlanTemplate,
  fetchPlanTemplates,
  updatePlanTemplate,
} from '../services/planTemplates.api'
import type { PlanTemplateInput } from '../types'

export const PLAN_TEMPLATES_KEY = 'plan-templates'

const errMsg = (err: unknown, fallback: string): string => {
  const res = err as { response?: { data?: { message?: string } } }
  return res.response?.data?.message || fallback
}

/** `includeInactive` is for the manage page; pickers only want active ones. */
export function usePlanTemplates(includeInactive = false) {
  return useQuery({
    queryKey: [PLAN_TEMPLATES_KEY, includeInactive],
    queryFn: () => fetchPlanTemplates(includeInactive),
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [PLAN_TEMPLATES_KEY] })
}

export function useCreatePlanTemplate() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (payload: PlanTemplateInput) => createPlanTemplate(payload),
    onSuccess: () => {
      void invalidate()
      toast.success('Template created')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to create template')),
  })
}

export function useUpdatePlanTemplate() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<PlanTemplateInput> & { isActive?: boolean }
    }) => updatePlanTemplate(id, data),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errMsg(err, 'Failed to update template')),
  })
}

export function useDeletePlanTemplate() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => deletePlanTemplate(id),
    onSuccess: () => {
      void invalidate()
      toast.success('Template deleted')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to delete template')),
  })
}
