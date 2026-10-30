import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2 } from 'lucide-react'
import { fieldError } from '@/components/forms/fieldError'
import { useLeaveForm } from '../hooks/useLeaveForm'
import { LEAVE_TYPE_OPTIONS } from '../types'
import type { EmployeeLeave, LeaveType } from '../types'

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
  const { form, isEditing, isPending } = useLeaveForm({
    employeeId,
    isOpen,
    leave,
    onDone: () => onOpenChange(false),
  })

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
                  onValueChange={(val) => field.handleChange(val as LeaveType)}
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
                {fieldError(field) && (
                  <p className="text-xs text-destructive">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="startDate">
            {(startField) => (
              <form.Field name="endDate">
                {(endField) => {
                  const error = fieldError(startField) ?? fieldError(endField)
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="leave-dates">Leave dates</Label>
                      <DateRangePicker
                        id="leave-dates"
                        className="w-full"
                        presets={[]}
                        clearable={false}
                        placeholder="Pick start and end dates"
                        value={{
                          from: startField.state.value,
                          to: endField.state.value,
                        }}
                        onChange={(r) => {
                          startField.handleChange(r.from)
                          endField.handleChange(r.to)
                        }}
                      />
                      {error && (
                        <p className="text-xs text-destructive">{error}</p>
                      )}
                    </div>
                  )
                }}
              </form.Field>
            )}
          </form.Field>

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
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={isPending || !canSubmit || isSubmitting}
                >
                  {(isPending || isSubmitting) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? 'Save Changes' : 'Submit Request'}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
