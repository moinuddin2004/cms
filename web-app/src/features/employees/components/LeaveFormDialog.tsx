import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2 } from 'lucide-react'
import { useCreateLeave, useUpdateLeave } from '../hooks/useLeave'
import {
  LEAVE_TYPE_OPTIONS,
  LeaveType,
  type EmployeeLeave,
  type LeaveFormData,
} from '../types'

interface LeaveFormDialogProps {
  employeeId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  leave?: EmployeeLeave | null
}

export function LeaveFormDialog({
  employeeId,
  isOpen,
  onOpenChange,
  leave,
}: LeaveFormDialogProps) {
  const createMutation = useCreateLeave()
  const updateMutation = useUpdateLeave()
  const isEditing = !!leave
  const isPending = createMutation.isPending || updateMutation.isPending

  const form = useForm({
    defaultValues: {
      leaveType: LeaveType.ANNUAL as string,
      startDate: '',
      endDate: '',
      reason: '',
    },
    onSubmit: async ({ value }) => {
      try {
        if (isEditing && leave) {
          await updateMutation.mutateAsync({
            id: leave.id,
            payload: value as LeaveFormData,
          })
        } else {
          await createMutation.mutateAsync({
            ...(value as LeaveFormData),
            employeeId,
          })
        }
        onOpenChange(false)
        form.reset()
      } catch {
        // toast handled in hooks
      }
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
      form.setFieldValue('leaveType', leave?.leaveType ?? LeaveType.ANNUAL)
      form.setFieldValue('startDate', leave?.startDate ?? '')
      form.setFieldValue('endDate', leave?.endDate ?? '')
      form.setFieldValue('reason', leave?.reason ?? '')
    }
  }, [isOpen, leave])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Leave Request' : 'New Leave Request'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the pending leave request details'
              : 'Submit a leave request for this employee'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 py-2"
        >
          <form.Field name="leaveType">
            {(field) => (
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => field.handleChange(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="startDate">
              {(field) => (
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name="endDate">
              {(field) => (
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="reason">
            {(field) => (
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="Reason for leave..."
                  rows={3}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
