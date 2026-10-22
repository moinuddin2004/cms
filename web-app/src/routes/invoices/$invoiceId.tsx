import { createFileRoute } from '@tanstack/react-router'
import { InvoiceDetailPage } from '@/features/billing'

export const Route = createFileRoute('/invoices/$invoiceId')({
  staticData: { can: 'billing.invoice.view' },
  component: InvoiceRoute,
})

function InvoiceRoute() {
  const { invoiceId } = Route.useParams()
  return <InvoiceDetailPage invoiceId={invoiceId} />
}
