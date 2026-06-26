import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PayrollPage } from '@/features/employees/pages/PayrollPage'

export const Route = createFileRoute('/payroll')({
  component: () => (
    <RequireFeaturePage feature="hr.payroll">
      <DashboardLayout>
        <PayrollPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
