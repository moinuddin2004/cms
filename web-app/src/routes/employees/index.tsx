import { createFileRoute } from '@tanstack/react-router'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmployeesPage } from '@/features/employees/pages/EmployeesPage'

export const Route = createFileRoute('/employees/')({
  component: () => (
    <RequireRolePage roles={['clinic_admin']}>
      <DashboardLayout>
        <EmployeesPage />
      </DashboardLayout>
    </RequireRolePage>
  ),
})
