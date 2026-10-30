import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/shared'
import { fieldError } from '@/components/forms/fieldError'
import { orderActionReasonSchema } from '../schemas/lab-order.schema'

/** Confirm a status action, asking for the reason the workflow records. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  isLoading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  isLoading: boolean
  onConfirm: (reason: string) => void
}) {
  const form = useForm({
    defaultValues: { reason: '' },
    validators: {
      onChange: orderActionReasonSchema,
      onSubmit: orderActionReasonSchema,
    },
    onSubmit: ({ value }) => onConfirm(value.reason.trim()),
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isLoading) onOpenChange(o)
      }}
    >
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form.Field name="reason">
            {(field) => (
              <FieldWrapper
                label="Reason"
                htmlFor="action-reason"
                required
                error={fieldError(field)}
              >
                <Textarea
                  id="action-reason"
                  rows={3}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoFocus
                />
              </FieldWrapper>
            )}
          </form.Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
            >
              Back
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  variant={destructive ? 'destructive' : 'default'}
                  disabled={!canSubmit || isSubmitting || isLoading}
                >
                  {(isLoading || isSubmitting) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {confirmLabel}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
