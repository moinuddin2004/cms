import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { PayablesReportsPage } from '@/features/lab-payables'

/** Payables aging, lab cost per month, case profit. */
export const Route = createFileRoute('/lab-payables_/reports')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <PayablesReportsPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
