import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmployeeForm } from './EmployeeForm'
import { useUpdateEmployee } from '../hooks/useUpdateEmployee'
import type { Employee, EmployeeFormData } from '../types'

interface EditEmployeeSheetProps {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEmployeeSheet({ employee, open, onOpenChange }: EditEmployeeSheetProps) {
  const updateMutation = useUpdateEmployee(employee.id)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSubmit = async (data: EmployeeFormData) => {
    setServerError(null)
    try {
      await updateMutation.mutateAsync(data)
      toast.success('Employee updated successfully')
      onOpenChange(false)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong.'
      setServerError(Array.isArray(msg) ? msg.join(', ') : msg)
    }
  }

  const handleCancel = () => {
    setServerError(null)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Edit Employee</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Edit Employee</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Update the details for {employee.fullName}.
            </p>
          </div>
          <EmployeeForm
            mode="edit"
            defaultValues={employee}
            onSubmit={handleSubmit}
            isPending={updateMutation.isPending}
            onCancel={handleCancel}
            serverError={serverError}
            variant="sheet"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
