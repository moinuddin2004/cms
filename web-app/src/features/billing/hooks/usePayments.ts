import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '../services/billing.api'
import { INVOICES_KEY, INVOICE_KEY, INVOICE_STATS_KEY } from './useInvoices'
import type { RecordPaymentInput } from '../types'

export function useInvoicePayments(invoiceId: string) {
  return useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: () => api.fetchInvoicePayments(invoiceId),
    enabled: !!invoiceId,
  })
}

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecordPaymentInput) =>
      api.recordPayment(invoiceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: [INVOICE_KEY, invoiceId] })
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] })
      qc.invalidateQueries({ queryKey: [INVOICE_STATS_KEY] })
      toast.success('Payment recorded')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to record payment'),
  })
}
