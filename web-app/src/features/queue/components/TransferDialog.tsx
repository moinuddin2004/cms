import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { useDoctors } from '@/features/appointments'
import { transferSchema } from '../schemas/queue.schema'
import type { QueueEntry } from '../types'

/** Move a patient to another doctor; they get a new token in that queue. */
export function TransferDialog({
  entry,
  currentDoctorId,
  onOpenChange,
  isLoading,
  onConfirm,
}: {
  entry: QueueEntry | null
  currentDoctorId?: string
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  onConfirm: (toDoctorId: string, reason: string) => void
}) {
  const { data: doctors = [] } = useDoctors()
  const form = useForm({
    defaultValues: { toDoctorId: '', reason: '' },
    validators: { onChange: transferSchema, onSubmit: transferSchema },
    onSubmit: ({ value }) => onConfirm(value.toDoctorId, value.reason.trim()),
  })

  useEffect(() => {
    form.reset()
  }, [entry?.id, form])

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[420px]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Transfer {entry?.token}</DialogTitle>
            <DialogDescription>
              {entry?.patient?.fullName} gets a new token in the other doctor's
              queue, keeping their original arrival time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <form.Field name="toDoctorId">
              {(field) => (
                <FieldWrapper
                  label="To doctor"
                  required
                  error={fieldError(field)}
                >
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => {
                      field.handleChange(v)
                      field.handleBlur()
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose a doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors
                        .filter((d) => d.id !== currentDoctorId)
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            Dr. {d.fullName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="reason">
              {(field) => (
                <FieldWrapper
                  label="Reason (optional)"
                  htmlFor="transfer-reason"
                  error={fieldError(field)}
                >
                  <Input
                    id="transfer-reason"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="h-9"
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Back
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || !!isLoading}
                >
                  {(isLoading || isSubmitting) && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  )}
                  Transfer
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
