import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { VendorBillsPage } from '@/features/lab-payables'

/** Vendor bills from labs — clinic admins. */
export const Route = createFileRoute('/lab-payables')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <VendorBillsPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
