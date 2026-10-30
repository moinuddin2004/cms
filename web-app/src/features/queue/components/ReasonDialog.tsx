import { useEffect, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { queueReasonSchema } from '../schemas/queue.schema'

/**
 * Confirm a queue action with a (required or optional) reason — cancel,
 * urgent priority, pause, send for test, stop consultation, select out of
 * order. Destructive actions show a red confirm button.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = 'Reason',
  placeholder,
  required = false,
  confirmLabel,
  destructive = false,
  isLoading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label?: string
  placeholder?: string
  required?: boolean
  confirmLabel: string
  destructive?: boolean
  isLoading?: boolean
  onConfirm: (reason: string) => void
}) {
  const schema = useMemo(
    () => queueReasonSchema(required, label),
    [required, label],
  )
  const form = useForm({
    defaultValues: { reason: '' },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => onConfirm(value.reason.trim()),
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[420px]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <form.Field name="reason">
            {(field) => (
              <FieldWrapper
                label={required ? label : `${label} (optional)`}
                htmlFor="queue-reason"
                required={required}
                error={fieldError(field)}
              >
                <Textarea
                  id="queue-reason"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={placeholder}
                  rows={2}
                  autoFocus
                />
              </FieldWrapper>
            )}
          </form.Field>
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
                  variant={destructive ? 'destructive' : 'default'}
                  disabled={!canSubmit || isSubmitting || isLoading}
                >
                  {(isLoading || isSubmitting) && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
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
