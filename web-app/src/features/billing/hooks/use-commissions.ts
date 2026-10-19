import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { billingKeys } from '../query-keys'
import { toastBillingError } from '../lib/billing-errors'
import { commissionsApi } from '../services/commissions.api'
import type {
  CommissionRuleInput,
  CompensationPlanInput,
} from '../types/commission.types'

export function useCompensationPlans(assignmentId: string | undefined) {
  return useQuery({
    queryKey: billingKeys.commissions.plans(assignmentId ?? ''),
    queryFn: () => commissionsApi.plans(assignmentId as string),
    enabled: !!assignmentId,
  })
}

/** Plan changes also refresh the employee (salary shown in its header). */
function usePlanMutation<T>(fn: (v: T) => Promise<unknown>, success: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: billingKeys.commissions.all }),
        qc.invalidateQueries({ queryKey: ['employee'] }),
        qc.invalidateQueries({ queryKey: ['employees'] }),
      ])
      toast.success(success)
    },
    onError: toastBillingError,
  })
}

export function useAddCompensationPlan(assignmentId: string) {
  return usePlanMutation(
    (body: CompensationPlanInput) => commissionsApi.addPlan(assignmentId, body),
    'Compensation saved',
  )
}

export function useReplaceCommissionRules() {
  return usePlanMutation(
    (v: { planId: string; rules: CommissionRuleInput[] }) =>
      commissionsApi.replaceRules(v.planId, v.rules),
    'Commission overrides saved',
  )
}

export function useCommissionEntries(filters: {
  assignmentId?: string
  from?: string
  to?: string
}) {
  return useQuery({
    queryKey: billingKeys.commissions.entries(filters),
    queryFn: () => commissionsApi.entries(filters),
  })
}

export function useDoctorEarnings(range: { from: string; to: string }) {
  const locationId = useAuthStore((s) => s.activeLocationId)
  return useQuery({
    queryKey: billingKeys.commissions.doctorEarnings({ ...range, locationId }),
    queryFn: () => commissionsApi.doctorEarnings(range),
    enabled: !!locationId,
  })
}

export function useMyEarnings(range: { from: string; to: string }) {
  const locationId = useAuthStore((s) => s.activeLocationId)
  return useQuery({
    queryKey: billingKeys.commissions.myEarnings({ ...range, locationId }),
    queryFn: () => commissionsApi.myEarnings(range),
    enabled: !!locationId,
  })
}
