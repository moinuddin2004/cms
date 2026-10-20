import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { LabPaymentsPage } from '@/features/lab-payables'

/** Payments to labs. */
export const Route = createFileRoute('/lab-payables_/payments')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <LabPaymentsPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
