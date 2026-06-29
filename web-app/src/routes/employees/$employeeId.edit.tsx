import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  EmployeeForm,
  useEmployee,
  useUpdateEmployee,
  type EmployeeFormData,
} from '@/features/employees'
import { toast } from 'sonner'
import { ChevronLeft, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/employees/$employeeId/edit')({
  component: EditEmployeePage,
})

function EditEmployeePage() {
  const { employeeId } = Route.useParams()
  const navigate = useNavigate()
  const { data: employee, isLoading: isEmployeeLoading } = useEmployee(employeeId)
  const updateMutation = useUpdateEmployee(employeeId)
  const [serverError, setServerError] = useState<string | null>(null)

  async function onSubmit(data: EmployeeFormData) {
    setServerError(null)
    try {
      await updateMutation.mutateAsync(data)
      toast.success('Employee updated successfully')
      navigate({ to: '/employees/$employeeId', params: { employeeId } })
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update employee'
      const text = Array.isArray(msg) ? msg.join(', ') : msg
      setServerError(text)
      toast.error(text)
    }
  }

  if (isEmployeeLoading) {
    return (
      <DashboardLayout title="Edit Employee">
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={`Edit ${employee?.fullName || 'Employee'}`}>
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          to="/employees/$employeeId"
          params={{ employeeId }}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Details
        </Link>

        <EmployeeForm
          key={employee?.id}
          mode="edit"
          defaultValues={employee}
          onSubmit={onSubmit}
          isPending={updateMutation.isPending}
          onCancel={() => navigate({ to: `/employees` })}
          serverError={serverError}
        />
      </div>
    </DashboardLayout>
  )
}
