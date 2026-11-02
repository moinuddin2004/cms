import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '../services/treatmentPlans.api'
import type { DiscountKind, TreatmentPlanInput } from '../types'

export const SERVICE_CATALOG_KEY = 'procedure-catalog'

export const planKeys = {
  /** Same key the patient record uses, so both stay in sync. */
  list: (patientId: string) =>
    ['patient', patientId, 'treatment-plans'] as const,
}

function errMsg(err: unknown, fallback: string): string {
  const res = err as { response?: { data?: { message?: unknown } } } | null
  const message = res?.response?.data?.message
  if (Array.isArray(message)) return String(message[0])
  return typeof message === 'string' ? message : fallback
}

/**
 * Procedures the clinic offers; with the price for price viewers — the
 * doctor's own price when `doctorId` is given (a plan's doctor).
 */
export function useServiceCatalog(doctorId?: string | null) {
  return useQuery({
    queryKey: doctorId
      ? [SERVICE_CATALOG_KEY, doctorId]
      : [SERVICE_CATALOG_KEY],
    queryFn: () => api.fetchServiceCatalog(doctorId),
    staleTime: 5 * 60_000,
  })
}

export function useTreatmentPlans(patientId: string) {
  return useQuery({
    queryKey: planKeys.list(patientId),
    queryFn: () => api.fetchTreatmentPlans(patientId),
    enabled: !!patientId,
  })
}

/**
 * After any plan change: the plans, the patient's treatments / history (a
 * session adds one), the open visit, and billing (the plan's invoice).
 */
function useRefresh(patientId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: planKeys.list(patientId) })
    void queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    void queryClient.invalidateQueries({ queryKey: ['consultation'] })
    void queryClient.invalidateQueries({
      queryKey: ['billing', 'patient', patientId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['billing', 'plan-summary'],
    })
  }
}

export function useSaveTreatmentPlan(patientId: string) {
  const refresh = useRefresh(patientId)
  return useMutation({
    mutationFn: ({
      planId,
      input,
    }: {
      planId: string | null
      input: TreatmentPlanInput
    }) =>
      planId
        ? api.updateTreatmentPlan(patientId, planId, input)
        : api.createTreatmentPlan(patientId, input),
    onSuccess: (_, { planId }) => {
      refresh()
      toast.success(planId ? 'Plan updated' : 'Plan created')
    },
    onError: (err) => toast.error(errMsg(err, 'Could not save the plan')),
  })
}

export function useSetPlanDiscount(patientId: string) {
  const refresh = useRefresh(patientId)
  return useMutation({
    mutationFn: (v: {
      planId: string
      kind: DiscountKind | null
      value: number | null
    }) => api.setTreatmentPlanDiscount(patientId, v.planId, v.kind, v.value),
    onSuccess: () => {
      refresh()
      toast.success('Discount saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Could not save the discount')),
  })
}

export function useAcceptPlan(patientId: string) {
  const refresh = useRefresh(patientId)
  return useMutation({
    mutationFn: (planId: string) => api.acceptTreatmentPlan(patientId, planId),
    onSuccess: () => {
      refresh()
      toast.success('Patient accepted the plan')
    },
    onError: (err) => toast.error(errMsg(err, 'Could not accept the plan')),
  })
}

export function useRecordPlanSession(patientId: string) {
  const refresh = useRefresh(patientId)
  return useMutation({
    mutationFn: (v: { planId: string; itemId: string; encounterId?: string }) =>
      api.recordPlanSession(patientId, v.planId, v.itemId, v.encounterId),
    onSuccess: () => refresh(),
    onError: (err) => toast.error(errMsg(err, 'Could not record the session')),
  })
}

export function useCancelPlan(patientId: string) {
  const refresh = useRefresh(patientId)
  return useMutation({
    mutationFn: (planId: string) => api.cancelTreatmentPlan(patientId, planId),
    onSuccess: (plan) => {
      refresh()
      toast.success(
        plan.invoiceId
          ? 'Plan cancelled. Ask reception to adjust its bill.'
          : 'Plan cancelled',
      )
    },
    onError: (err) => toast.error(errMsg(err, 'Could not cancel the plan')),
  })
}
