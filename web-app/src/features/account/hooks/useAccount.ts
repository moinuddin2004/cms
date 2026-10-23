import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import * as accountApi from '../services/account.api'
import type {
  RecordPaymentInput,
  SetupClinicInput,
  SetupLocationInput,
  UpdateSubscriptionInput,
} from '../schemas/account.schema'

export const accountKeys = {
  summary: (orgId: string | null) => ['account', orgId] as const,
  setup: (orgId: string | null) => ['account', orgId, 'setup'] as const,
  admin: {
    all: ['admin-subscriptions'] as const,
    one: (orgId: string) => ['admin-subscriptions', orgId] as const,
    instructions: ['admin-subscriptions', 'payment-instructions'] as const,
  },
}

/** The active clinic's plan, status, usage (and payments, for owners). */
export function useAccountSummary(enabled = true) {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const locationId = useAuthStore((s) => s.activeLocationId)
  return useQuery({
    queryKey: accountKeys.summary(orgId),
    queryFn: accountApi.fetchAccount,
    enabled: enabled && !!orgId && !!locationId,
    staleTime: 60_000,
  })
}

export function useClinicSetup() {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useQuery({
    queryKey: accountKeys.setup(orgId),
    queryFn: accountApi.fetchClinicSetup,
    enabled: !!orgId,
  })
}

function useSetupMutation<TInput>(
  fn: (input: TInput) => ReturnType<typeof accountApi.fetchClinicSetup>,
) {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(accountKeys.setup(orgId), data)
      void qc.invalidateQueries({ queryKey: accountKeys.summary(orgId) })
    },
  })
}

export const useSaveSetupClinic = () =>
  useSetupMutation((input: SetupClinicInput) =>
    accountApi.saveSetupClinic(input),
  )
export const useSaveSetupLocation = () =>
  useSetupMutation((input: SetupLocationInput) =>
    accountApi.saveSetupLocation(input),
  )
export const useCompleteSetup = () =>
  useSetupMutation((_: void) => accountApi.completeSetup())

export function useResendVerification() {
  return useMutation({ mutationFn: accountApi.resendVerification })
}

// ── Super admin ───────────────────────────────────────────────────────

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: accountKeys.admin.all,
    queryFn: accountApi.fetchAdminSubscriptions,
  })
}

export function useAdminSubscription(orgId: string | null) {
  return useQuery({
    queryKey: accountKeys.admin.one(orgId ?? ''),
    queryFn: () => accountApi.fetchAdminSubscription(orgId!),
    enabled: !!orgId,
  })
}

function useAdminMutation<TInput, TOut>(
  orgId: string | null,
  fn: (orgId: string, input: TInput) => Promise<TOut>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => fn(orgId!, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountKeys.admin.all })
      // The super admin may be looking at this clinic's own banner too.
      void qc.invalidateQueries({ queryKey: ['account'] })
    },
  })
}

export const useUpdateAdminSubscription = (orgId: string | null) =>
  useAdminMutation(orgId, (id, input: UpdateSubscriptionInput) =>
    accountApi.updateAdminSubscription(id, input),
  )
export const useRecordSubscriptionPayment = (orgId: string | null) =>
  useAdminMutation(orgId, (id, input: RecordPaymentInput) =>
    accountApi.recordSubscriptionPayment(id, input),
  )

export function usePaymentInstructions() {
  return useQuery({
    queryKey: accountKeys.admin.instructions,
    queryFn: accountApi.fetchPaymentInstructions,
  })
}

export function useSavePaymentInstructions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: accountApi.savePaymentInstructions,
    onSuccess: (data) => {
      qc.setQueryData(accountKeys.admin.instructions, data)
      void qc.invalidateQueries({ queryKey: ['account'] })
    },
  })
}
