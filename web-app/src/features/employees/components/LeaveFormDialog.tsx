import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useCreateLeave, useUpdateLeave } from '../hooks/useLeave'
import {
  LEAVE_TYPE_OPTIONS,
  LeaveType,
  leaveFormSchema,
  type EmployeeLeave,
  type LeaveFormData,
} from '../types'

interface LeaveFormDialogProps {
  employeeId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this (pending) leave instead of creating */
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

  const form = useForm<LeaveFormData>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      leaveType: LeaveType.ANNUAL,
      startDate: '',
      endDate: '',
      reason: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset({
        leaveType: leave?.leaveType ?? LeaveType.ANNUAL,
        startDate: leave?.startDate ?? '',
        endDate: leave?.endDate ?? '',
        reason: leave?.reason ?? '',
      })
    }
  }, [isOpen, leave, form])

  async function onSubmit(data: LeaveFormData) {
    try {
      if (isEditing && leave) {
        await updateMutation.mutateAsync({ id: leave.id, payload: data })
      } else {
        await createMutation.mutateAsync({ ...data, employeeId })
      }
      onOpenChange(false)
      form.reset()
    } catch {
      // toast handled in hooks
    }
  }

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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-2"
          >
            <FormField
              control={form.control}
              name="leaveType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reason for leave..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  )
}
