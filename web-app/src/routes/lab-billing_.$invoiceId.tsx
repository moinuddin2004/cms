import { createFileRoute } from '@tanstack/react-router'
import { LabInvoiceDetailPage } from '@/features/lab-billing'

/** One lab invoice or estimate. */
export const Route = createFileRoute('/lab-billing_/$invoiceId')({
  staticData: { can: 'lab.billing.manage' },
  component: LabInvoiceRoute,
})

function LabInvoiceRoute() {
  const { invoiceId } = Route.useParams()
  return <LabInvoiceDetailPage invoiceId={invoiceId} />
}
