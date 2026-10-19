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
import { reasonSchema } from '../schemas/lab.schema'
import type { LabLink } from '../types'

/** Suspending a lab needs a reason — it is kept in the lab's history. */
export function SuspendLinkDialog({
  link,
  onOpenChange,
  onConfirm,
}: {
  link: LabLink | null
  onOpenChange: (open: boolean) => void
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
    if (link) form.reset({ reason: '' })
  }, [link, form])

  return (
    <Dialog
      open={!!link}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suspend {link?.lab.name}?</DialogTitle>
          <DialogDescription>
            No new orders can go to this lab until you reactivate it. Orders
            already with the lab are not affected.
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
                htmlFor="suspend-reason"
                required
                error={fieldError(f)}
              >
                <Textarea
                  id="suspend-reason"
                  rows={3}
                  autoFocus
                  placeholder="e.g. Repeated late deliveries"
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
                Suspend lab
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
