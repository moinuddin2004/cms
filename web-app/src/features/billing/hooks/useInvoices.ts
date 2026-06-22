import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import * as api from '../services/billing.api'
import type { CreateInvoiceInput, InvoiceFilters } from '../types'

export const INVOICES_KEY = 'invoices'
export const INVOICE_KEY = 'invoice'
export const INVOICE_STATS_KEY = 'invoice-stats'

function errMsg(err: any, fallback: string) {
  return err?.response?.data?.message || fallback
}

export function useInvoices(filters: InvoiceFilters) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: [INVOICES_KEY, activeLocationId, filters],
    queryFn: () => api.fetchInvoices(filters),
    enabled: !!activeLocationId,
    placeholderData: (prev) => prev,
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: [INVOICE_KEY, id],
    queryFn: () => api.fetchInvoice(id),
    enabled: !!id,
  })
}

export function useInvoiceStats() {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: [INVOICE_STATS_KEY, activeLocationId],
    queryFn: () => api.fetchInvoiceStats(),
    enabled: !!activeLocationId,
  })
}

function useInvalidateInvoices() {
  const qc = useQueryClient()
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: [INVOICES_KEY] })
    qc.invalidateQueries({ queryKey: [INVOICE_STATS_KEY] })
    if (id) qc.invalidateQueries({ queryKey: [INVOICE_KEY, id] })
  }
}

export function useCreateInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (payload: CreateInvoiceInput) => api.createInvoice(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Invoice created')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to create invoice')),
  })
}

export function useUpdateInvoice(id: string) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.updateInvoice>[1]) =>
      api.updateInvoice(id, payload),
    onSuccess: () => {
      invalidate(id)
      toast.success('Invoice updated')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update invoice')),
  })
}

export function useUpdateInvoiceStatus(id: string) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (status: string) => api.updateInvoiceStatus(id, status),
    onSuccess: () => {
      invalidate(id)
      toast.success('Status updated')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update status')),
  })
}

export function useAddInvoiceItem(id: string) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (payload: {
      description: string
      quantity: number
      unitPrice: number
    }) => api.addInvoiceItem(id, payload),
    onSuccess: () => invalidate(id),
    onError: (e) => toast.error(errMsg(e, 'Failed to add item')),
  })
}

export function useRemoveInvoiceItem(id: string) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (itemId: string) => api.removeInvoiceItem(id, itemId),
    onSuccess: () => invalidate(id),
    onError: (e) => toast.error(errMsg(e, 'Failed to remove item')),
  })
}

export function useGenerateFromTreatmentPlan() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (planId: string) =>
      api.generateInvoiceFromTreatmentPlan(planId),
    onSuccess: () => {
      invalidate()
      toast.success('Invoice generated from treatment plan')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to generate invoice')),
  })
}

export function useApplyCoupon(id: string) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (code: string) => api.applyCoupon(id, code),
    onSuccess: () => {
      invalidate(id)
      toast.success('Coupon applied')
    },
    onError: (e) => toast.error(errMsg(e, 'Invalid coupon')),
  })
}

export function useRemoveCoupon(id: string) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: () => api.removeCoupon(id),
    onSuccess: () => {
      invalidate(id)
      toast.success('Coupon removed')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to remove coupon')),
  })
}
