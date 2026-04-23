import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmployeeForm, useCreateEmployee, type EmployeeFormData } from '@/features/employees'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/employees/create')({
  component: CreateEmployeePage,
})

function CreateEmployeePage() {
  const navigate = useNavigate()
  const createMutation = useCreateEmployee()

  async function onSubmit(data: EmployeeFormData) {
    try {
      const res = await createMutation.mutateAsync(data)
      toast.success('Employee added successfully')
      navigate({ to: `/employees/${res.id}` })
    } catch (error) {
      toast.error('Failed to create employee')
    }
  }

  return (
    <DashboardLayout title="Add New Employee">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          to="/employees"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Employees
        </Link>
        <EmployeeForm
          mode="create"
          onSubmit={onSubmit}
          isPending={createMutation.isPending}
          onCancel={() => navigate({ to: '/employees' })}
        />
      </div>
    </DashboardLayout>
  )
}
