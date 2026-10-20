import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastPayablesError } from '../lib/payables-errors'
import { labPayablesApi } from '../services/lab-payables.api'
import type { BillParams } from '../types'

/** Every payables query under one root, so a mutation refreshes them all. */
export const payablesKeys = {
  all: ['lab-payables'] as const,
  bills: (p: BillParams) => ['lab-payables', 'bills', p] as const,
  bill: (id: string) => ['lab-payables', 'bill', id] as const,
  payments: (p: object) => ['lab-payables', 'payments', p] as const,
  statements: (p: object) => ['lab-payables', 'statements', p] as const,
  statement: (id: string) => ['lab-payables', 'statement', id] as const,
  report: (name: string, p: object) =>
    ['lab-payables', 'report', name, p] as const,
}

export function useVendorBills(params: BillParams) {
  return useQuery({
    queryKey: payablesKeys.bills(params),
    queryFn: () => labPayablesApi.bills(params),
    placeholderData: keepPreviousData,
  })
}

export function useVendorBill(id: string) {
  return useQuery({
    queryKey: payablesKeys.bill(id),
    queryFn: () => labPayablesApi.bill(id),
  })
}

export function useLabPayments(params: {
  page: number
  limit: number
  labId?: string
}) {
  return useQuery({
    queryKey: payablesKeys.payments(params),
    queryFn: () => labPayablesApi.payments(params),
    placeholderData: keepPreviousData,
  })
}

export function useLabStatements(params: {
  page: number
  limit: number
  labId?: string
  status?: string
}) {
  return useQuery({
    queryKey: payablesKeys.statements(params),
    queryFn: () => labPayablesApi.statements(params),
    placeholderData: keepPreviousData,
  })
}

export function useLabStatement(id: string) {
  return useQuery({
    queryKey: payablesKeys.statement(id),
    queryFn: () => labPayablesApi.statement(id),
  })
}

export function useAgingReport(labId?: string) {
  return useQuery({
    queryKey: payablesKeys.report('aging', { labId }),
    queryFn: () => labPayablesApi.aging(labId),
  })
}

export function useMonthlyCostReport(year: number) {
  return useQuery({
    queryKey: payablesKeys.report('monthly', { year }),
    queryFn: () => labPayablesApi.monthlyCost(year),
  })
}

export function useCaseProfitReport(params: {
  page: number
  limit: number
  labId?: string
  from?: string
  to?: string
}) {
  return useQuery({
    queryKey: payablesKeys.report('case-profit', params),
    queryFn: () => labPayablesApi.caseProfit(params),
    placeholderData: keepPreviousData,
  })
}

/** A payables mutation: toasts the outcome and refreshes every payables query. */
export function usePayablesMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
    },
    onError: toastPayablesError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: payablesKeys.all }),
  })
}
