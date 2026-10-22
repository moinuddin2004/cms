import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PayrollPage } from '@/features/employees/pages/PayrollPage'

export const Route = createFileRoute('/payroll')({
  staticData: { can: 'payroll.manage' },
  component: () => (
    <DashboardLayout>
      <PayrollPage />
    </DashboardLayout>
  ),
})
