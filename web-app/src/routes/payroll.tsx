import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PayrollPage } from '@/features/employees/pages/PayrollPage'

export const Route = createFileRoute('/payroll')({
  staticData: { can: 'payroll.manage' },
  component: () => (
    <RequireFeaturePage feature="hr.payroll">
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <PayrollPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
