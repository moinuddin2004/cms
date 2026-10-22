import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmployeesPage } from '@/features/employees/pages/EmployeesPage'

export const Route = createFileRoute('/employees/')({
  staticData: { can: 'employees.view' },
  component: () => (
    <DashboardLayout>
      <EmployeesPage />
    </DashboardLayout>
  ),
})
