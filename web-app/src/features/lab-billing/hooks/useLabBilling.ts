import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { labBillingErrorMessage } from '../lib/lab-billing-errors'
import { labBillingKeys } from '../query-keys'
import { labBillingApi } from '../services/lab-billing.api'
import type { InvoiceParams, PaymentParams } from '../types'

export function useLabInvoices(params: InvoiceParams) {
  return useQuery({
    queryKey: labBillingKeys.invoices(params),
    queryFn: () => labBillingApi.invoices(params),
    placeholderData: keepPreviousData,
  })
}

export function useLabInvoice(id: string) {
  return useQuery({
    queryKey: labBillingKeys.invoice(id),
    queryFn: () => labBillingApi.invoice(id),
  })
}

export function useLabPayments(params: PaymentParams, enabled = true) {
  return useQuery({
    queryKey: labBillingKeys.payments(params),
    queryFn: () => labBillingApi.payments(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useOrderBilling(orderId: string, enabled = true) {
  return useQuery({
    queryKey: labBillingKeys.order(orderId),
    queryFn: () => labBillingApi.order(orderId),
    enabled,
  })
}

export function useLabBillingSettings() {
  return useQuery({
    queryKey: [...labBillingKeys.all, 'settings'],
    queryFn: () => labBillingApi.settings(),
    staleTime: 60_000,
  })
}

/** A billing action: toast on success / error, then refresh every lab-billing query. */
export function useLabBillingMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
    },
    onError: (err) => toast.error(labBillingErrorMessage(err)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: labBillingKeys.all }),
  })
}
