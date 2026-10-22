import { createFileRoute } from '@tanstack/react-router'
import { LabBillingPage } from '@/features/lab-billing'

/** Lab billing — invoices and payments for lab work (front desk). */
export const Route = createFileRoute('/lab-billing')({
  staticData: { can: 'lab.billing.manage' },
  component: () => <LabBillingPage />,
})
