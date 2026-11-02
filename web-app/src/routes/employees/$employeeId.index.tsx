import { createFileRoute } from '@tanstack/react-router'
import { EmployeeDetailPage } from '@/features/employees/pages/EmployeeDetailPage'

export const Route = createFileRoute('/employees/$employeeId/')({
  staticData: { can: 'employees.view' },
  component: EmployeeDetailRoute,
})

function EmployeeDetailRoute() {
  const { employeeId } = Route.useParams()
  return <EmployeeDetailPage employeeId={employeeId} />
}
