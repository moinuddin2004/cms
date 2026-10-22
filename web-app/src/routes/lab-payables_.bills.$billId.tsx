import { createFileRoute } from '@tanstack/react-router'
import { VendorBillDetailPage } from '@/features/lab-payables'

/** One vendor bill. */
export const Route = createFileRoute('/lab-payables_/bills/$billId')({
  staticData: { can: 'lab.payables.manage' },
  component: VendorBillRoute,
})

function VendorBillRoute() {
  const { billId } = Route.useParams()
  return <VendorBillDetailPage billId={billId} />
}
