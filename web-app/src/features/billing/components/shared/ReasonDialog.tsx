import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/features/queue/utils/fieldError'
import { reasonSchema } from '../../schemas/billing.schema'

/**
 * Destructive billing action with a required reason (void, cancel,
 * unapply — plan §8.5). The description names the amount and patient.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: { reason: '' },
    validators: { onChange: reasonSchema, onSubmit: reasonSchema },
    onSubmit: async ({ value }) => {
      await onConfirm(value.reason.trim())
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <form.Field name="reason">
            {(field) => (
              <FieldWrapper
                label="Reason"
                htmlFor="billing-reason"
                required
                error={fieldError(field)}
              >
                <Textarea
                  id="billing-reason"
                  dir="auto"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  rows={3}
                  autoFocus
                />
              </FieldWrapper>
            )}
          </form.Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Back</AlertDialogCancel>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {confirmLabel}
                </Button>
              )}
            </form.Subscribe>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
