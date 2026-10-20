import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { LabInvoiceDetailPage } from '@/features/lab-billing'

/** One lab invoice or estimate. */
export const Route = createFileRoute('/lab-billing_/$invoiceId')({
  component: LabInvoiceRoute,
})

function LabInvoiceRoute() {
  const { invoiceId } = Route.useParams()
  return (
    <RequireFeaturePage feature="dental.lab_orders">
      <LabInvoiceDetailPage invoiceId={invoiceId} />
    </RequireFeaturePage>
  )
}
