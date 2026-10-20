import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { LabStatementsPage } from '@/features/lab-payables'

/** Monthly lab statements. */
export const Route = createFileRoute('/lab-payables_/statements')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <LabStatementsPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
