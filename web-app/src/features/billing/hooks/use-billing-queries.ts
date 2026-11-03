import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAccess } from '@/features/access'
import { useAuthStore } from '@/store/useAuthStore'
import { billingKeys } from '../query-keys'
import {
  chargesApi,
  configApi,
  invoicesApi,
  paymentsApi,
  reportsApi,
} from '../services/billing-v2.api'
import type { InvoiceFiltersV2 } from '../services/billing-v2.api'
import { BILLING_READ_PERMS } from '../lib/billing-permissions'

/** Billing reads run only with some billing access at a location (the API checks each). */
function useEnabled(extra = true): boolean {
  const locationId = useAuthStore((s) => s.activeLocationId)
  const { can } = useAccess()
  return !!locationId && can(BILLING_READ_PERMS) && extra
}

// ─── Configuration ──────────────────────────────────────────────────

export const useBillingSettings = () =>
  useQuery({
    queryKey: billingKeys.settings(),
    queryFn: configApi.settings,
    enabled: useEnabled(),
  })

export const useCatalogServices = (params: { activeOnly?: boolean } = {}) =>
  useQuery({
    queryKey: billingKeys.services(params),
    queryFn: () => configApi.services(params),
    enabled: useEnabled(),
  })

export const useServicePrices = (serviceId?: string) =>
  useQuery({
    queryKey: billingKeys.prices(serviceId),
    queryFn: () => configApi.prices(serviceId),
    enabled: useEnabled(),
  })

export const usePaymentAccounts = (activeOnly = false) =>
  useQuery({
    queryKey: billingKeys.paymentAccounts(activeOnly),
    queryFn: () => configApi.accounts(activeOnly),
    enabled: useEnabled(),
  })

export const useDiscountTypes = (usableToday = false, enabled = true) =>
  useQuery({
    queryKey: billingKeys.discountTypes(usableToday),
    queryFn: () => configApi.discountTypes(usableToday),
    enabled: useEnabled(enabled),
    retry: false,
  })

// ─── Patient billing ────────────────────────────────────────────────

export const usePatientBillingSummary = (patientId: string | undefined) =>
  useQuery({
    queryKey: billingKeys.patient(patientId ?? '').summary(),
    queryFn: () => reportsApi.summary(patientId as string),
    enabled: useEnabled(!!patientId),
  })

export const useOpenCharges = (patientId: string | undefined) =>
  useQuery({
    queryKey: billingKeys.patient(patientId ?? '').openCharges(),
    queryFn: () => reportsApi.openCharges(patientId as string),
    enabled: useEnabled(!!patientId),
  })

export const usePatientCharges = (
  patientId: string,
  state: 'unbilled' | 'open' | 'all',
) =>
  useQuery({
    queryKey: billingKeys.patient(patientId).charges(state),
    queryFn: () => chargesApi.list(patientId, state),
    enabled: useEnabled(),
  })

export const useStatement = (
  patientId: string,
  range: { from?: string; to?: string },
) =>
  useQuery({
    queryKey: billingKeys.patient(patientId).statement(range),
    queryFn: () => reportsApi.statement(patientId, range),
    enabled: useEnabled(),
  })

export const usePatientInvoices = (patientId: string) =>
  useQuery({
    queryKey: billingKeys.patient(patientId).invoices(),
    queryFn: () => invoicesApi.list({ patientId, limit: 100 }),
    enabled: useEnabled(),
  })

export const usePatientPayments = (patientId: string) =>
  useQuery({
    queryKey: billingKeys.patient(patientId).payments(),
    queryFn: () => paymentsApi.list({ patientId, limit: 100 }),
    enabled: useEnabled(),
  })

/** Queue / header badges; only when the location shows them (D22). */
export function useOutstanding(patientIds: string[]) {
  const settings = useBillingSettings()
  const show = settings.data?.showOutstandingAtCheckIn ?? false
  return useQuery({
    queryKey: billingKeys.outstanding(patientIds),
    queryFn: () => reportsApi.outstanding(patientIds.slice(0, 100)),
    enabled: useEnabled(show && patientIds.length > 0),
    staleTime: 30_000,
  })
}

// ─── Invoices, payments, desk ───────────────────────────────────────

export const useInvoiceList = (filters: InvoiceFiltersV2) =>
  useQuery({
    queryKey: billingKeys.invoices.list(filters),
    queryFn: () => invoicesApi.list(filters),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  })

export const useInvoiceStatsV2 = (range: { from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: billingKeys.invoices.stats(range),
    queryFn: () => invoicesApi.stats(range),
    enabled: useEnabled(),
  })

export const useInvoiceDetail = (id: string) =>
  useQuery({
    queryKey: billingKeys.invoices.detail(id),
    queryFn: () => invoicesApi.detail(id),
    enabled: useEnabled(),
  })

/** Refunds in a date range (patient + advance refunds). */
export const useRefundList = (filters: {
  from?: string
  to?: string
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: billingKeys.payments.refunds(filters),
    queryFn: () => paymentsApi.refunds(filters),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  })

export const usePaymentList = (filters: {
  from?: string
  to?: string
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: billingKeys.payments.list(filters),
    queryFn: () => paymentsApi.list(filters),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  })

export const useDailyCollection = (date?: string) =>
  useQuery({
    queryKey: billingKeys.payments.daily(date),
    queryFn: () => paymentsApi.dailyCollection(date),
    enabled: useEnabled(),
  })

export const useReadyToBill = (date?: string) =>
  useQuery({
    queryKey: billingKeys.readyToBill(date),
    queryFn: () => chargesApi.readyToBill(date),
    enabled: useEnabled(),
  })

export const useCashClosePreview = (enabled: boolean) =>
  useQuery({
    queryKey: billingKeys.cashClose.preview(),
    queryFn: reportsApi.cashClosePreview,
    enabled: useEnabled(enabled),
  })

export const useCashCloseHistory = () =>
  useQuery({
    queryKey: billingKeys.cashClose.history(),
    queryFn: () => reportsApi.cashCloses(),
    enabled: useEnabled(),
  })

export const useDoctorRevenue = (range: { from: string; to: string }) =>
  useQuery({
    queryKey: billingKeys.reports.doctorRevenue(range),
    queryFn: () => reportsApi.doctorRevenue(range),
    enabled: useEnabled(),
  })

export const usePlanBillingSummary = (planId: string) =>
  useQuery({
    queryKey: billingKeys.planSummary(planId),
    queryFn: () => reportsApi.planSummary(planId),
    enabled: useEnabled(),
  })

export const useBillingActivity = (filters: {
  from?: string
  to?: string
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: billingKeys.activity(filters),
    queryFn: () => reportsApi.activity(filters),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  })
