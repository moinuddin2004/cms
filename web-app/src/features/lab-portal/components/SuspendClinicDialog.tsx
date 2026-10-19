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
import { fieldError } from '@/features/queue'
import { suspendClinicSchema } from '../schemas/lab-portal.schema'
import type { PortalClinic } from '../types'

/** Suspending (or declining) a clinic needs a reason — the clinic sees it. */
export function SuspendClinicDialog({
  link,
  onOpenChange,
  onConfirm,
}: {
  link: PortalClinic | null
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: { reason: '' },
    validators: {
      onChange: suspendClinicSchema,
      onSubmit: suspendClinicSchema,
    },
    onSubmit: async ({ value }) => {
      await onConfirm(value.reason.trim())
      onOpenChange(false)
    },
  })
  useEffect(() => {
    if (link) form.reset({ reason: '' })
  }, [link, form])

  const declining = link?.status === 'invited'

  return (
    <Dialog
      open={!!link}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {declining ? 'Decline' : 'Suspend'} {link?.clinic.name}?
          </DialogTitle>
          <DialogDescription>
            {declining
              ? 'The clinic can’t send you orders. You can reactivate the link later.'
              : 'The clinic can’t send you new orders until you reactivate it. Work already in the lab is not affected.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="reason">
            {(f) => (
              <FieldWrapper
                label="Reason"
                htmlFor="suspend-clinic-reason"
                required
                error={fieldError(f)}
              >
                <Textarea
                  id="suspend-clinic-reason"
                  rows={3}
                  autoFocus
                  placeholder="e.g. Outstanding balance"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                variant="destructive"
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {declining ? 'Decline clinic' : 'Suspend clinic'}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
