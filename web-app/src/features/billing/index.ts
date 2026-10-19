// Billing feature barrel — import from here across features.
export * from './types/billing.types'
export { billingKeys } from './query-keys'
export { useBillingAccess } from './hooks/use-billing-access'
export {
  useOutstanding,
  usePlanBillingSummary,
} from './hooks/use-billing-queries'
export { CollectPaymentSheet } from './components/collect-payment/CollectPaymentSheet'
export { PatientBillingTab } from './components/patient-billing/PatientBillingTab'
export {
  OutstandingBadge,
  PaymentStatusBadge,
  Money,
} from './components/shared/billing-badges'
export { PrintButton } from './components/print/PrintButton'
export { BillingDeskPage } from './pages/BillingDeskPage'
export { InvoicesPage } from './pages/InvoicesPage'
export { InvoiceDetailPage } from './pages/InvoiceDetailPage'
export { PaymentsPage } from './pages/PaymentsPage'
export { BillingSettingsPage } from './pages/BillingSettingsPage'
export {
  BillingActivityPage,
  DoctorRevenuePage,
} from './pages/BillingReportsPages'
export { ExpensesPage } from './pages/ExpensesPage'
export { QueueBillingCell } from './components/queue/QueueBillingCell'

// Doctor compensation / commissions
export * from './types/commission.types'
export { COMMISSIONS_FEATURE } from './lib/commission-constants'
export { CompensationTab } from './components/compensation/CompensationTab'
export {
  useMyEarnings,
  useDoctorEarnings,
} from './hooks/use-commissions'
export { DoctorEarningsPage, MyEarningsPage } from './pages/CommissionPages'
