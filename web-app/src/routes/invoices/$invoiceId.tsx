import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { InvoiceDetailPage } from '@/features/billing'

export const Route = createFileRoute('/invoices/$invoiceId')({
  component: InvoiceRoute,
})

function InvoiceRoute() {
  const { invoiceId } = Route.useParams()
  return (
    <RequireFeaturePage feature="billing.invoices">
      <RequireRolePage roles={['clinic_admin', 'receptionist']}>
        <InvoiceDetailPage invoiceId={invoiceId} />
      </RequireRolePage>
    </RequireFeaturePage>
  )
}
