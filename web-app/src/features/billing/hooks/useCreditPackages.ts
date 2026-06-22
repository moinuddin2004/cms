import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import * as api from '../services/billing.api'

const PACKAGES_KEY = 'credit-packages'
const PATIENT_CREDITS_KEY = 'patient-credits'

function errMsg(e: any, fb: string) {
  return e?.response?.data?.message || fb
}

export function useCreditPackages() {
  const { activeOrganizationId } = useAuthStore()
  return useQuery({
    queryKey: [PACKAGES_KEY, activeOrganizationId],
    queryFn: () => api.fetchCreditPackages(),
    enabled: !!activeOrganizationId,
  })
}

export function useCreateCreditPackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createCreditPackage>[0]) =>
      api.createCreditPackage(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PACKAGES_KEY] })
      toast.success('Credit package created')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to create package')),
  })
}

export function usePatientCredits(patientId: string) {
  return useQuery({
    queryKey: [PATIENT_CREDITS_KEY, patientId],
    queryFn: () => api.fetchPatientCredits(patientId),
    enabled: !!patientId,
  })
}

export function usePurchaseCredit(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (creditPackageId: string) =>
      api.purchaseCredit(patientId, creditPackageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PATIENT_CREDITS_KEY, patientId] })
      toast.success('Package purchased')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to purchase package')),
  })
}

export function useUseCredit(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ creditId, amount }: { creditId: string; amount: number }) =>
      api.useCredit(patientId, creditId, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PATIENT_CREDITS_KEY, patientId] })
      toast.success('Credit applied')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to apply credit')),
  })
}
