import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { VendorBillDetailPage } from '@/features/lab-payables'

/** One vendor bill. */
export const Route = createFileRoute('/lab-payables_/bills/$billId')({
  component: VendorBillRoute,
})

function VendorBillRoute() {
  const { billId } = Route.useParams()
  return (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <VendorBillDetailPage billId={billId} />
      </RequireRolePage>
    </RequireFeaturePage>
  )
}
