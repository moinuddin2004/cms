import { createFileRoute } from '@tanstack/react-router'
import { VendorBillsPage } from '@/features/lab-payables'

/** Vendor bills from labs — clinic admins. */
export const Route = createFileRoute('/lab-payables')({
  staticData: { can: 'lab.payables.manage' },
  component: () => <VendorBillsPage />,
})
