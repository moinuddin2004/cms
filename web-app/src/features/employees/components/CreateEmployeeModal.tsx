import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmployeeForm } from './EmployeeForm'
import { useCreateEmployee } from '../hooks/useCreateEmployee'
import type { EmployeeFormData } from '../types'

interface CreateEmployeeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateEmployeeModal({ open, onOpenChange }: CreateEmployeeModalProps) {
  const createMutation = useCreateEmployee()
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSubmit = async (data: EmployeeFormData) => {
    setServerError(null)
    try {
      await createMutation.mutateAsync(data)
      toast.success('Employee created successfully')
      onOpenChange(false)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong.'
      setServerError(Array.isArray(msg) ? msg.join(', ') : msg)
    }
  }

  const handleClose = () => {
    setServerError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="w-full sm:max-w-6xl max-h-[92vh] overflow-y-auto gap-0 p-0">
        <DialogTitle className="sr-only">Add Employee</DialogTitle>
        <div className="px-6 py-5 pr-12">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Add Employee</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Fill in the details to add a new employee to this location.
            </p>
          </div>
          <EmployeeForm
            mode="create"
            onSubmit={handleSubmit}
            isPending={createMutation.isPending}
            onCancel={handleClose}
            serverError={serverError}
            variant="sheet"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
