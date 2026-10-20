import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { LabBillingPage } from '@/features/lab-billing'

/** Lab billing — invoices and payments for lab work (front desk). */
export const Route = createFileRoute('/lab-billing')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <LabBillingPage />
    </RequireFeaturePage>
  ),
})
