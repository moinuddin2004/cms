import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createTreatmentPlanTemplate,
  deactivateTreatmentPlanTemplate,
  fetchTreatmentPlanTemplate,
  fetchTreatmentPlanTemplates,
  updateTreatmentPlanTemplate,
} from '../services/prescriptions.api'
import type { TreatmentPlanTemplate } from '../types'

export const TREATMENT_PLAN_TEMPLATES_KEY = 'treatment-plan-templates'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function useTreatmentPlanTemplates(category?: string) {
  return useQuery({
    queryKey: [TREATMENT_PLAN_TEMPLATES_KEY, category ?? null],
    queryFn: () => fetchTreatmentPlanTemplates(category),
  })
}

export function useTreatmentPlanTemplate(id: string | undefined) {
  return useQuery({
    queryKey: [TREATMENT_PLAN_TEMPLATES_KEY, id],
    queryFn: () => fetchTreatmentPlanTemplate(id!),
    enabled: !!id,
  })
}

export function useCreateTreatmentPlanTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<TreatmentPlanTemplate>) =>
      createTreatmentPlanTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TREATMENT_PLAN_TEMPLATES_KEY] })
      toast.success('Treatment plan template saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save plan template')),
  })
}

export function useUpdateTreatmentPlanTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<TreatmentPlanTemplate>
    }) => updateTreatmentPlanTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TREATMENT_PLAN_TEMPLATES_KEY] })
      toast.success('Treatment plan template updated')
    },
    onError: (err) =>
      toast.error(errMsg(err, 'Failed to update plan template')),
  })
}

export function useDeactivateTreatmentPlanTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateTreatmentPlanTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TREATMENT_PLAN_TEMPLATES_KEY] })
      toast.success('Treatment plan template deactivated')
    },
    onError: (err) =>
      toast.error(errMsg(err, 'Failed to deactivate plan template')),
  })
}
