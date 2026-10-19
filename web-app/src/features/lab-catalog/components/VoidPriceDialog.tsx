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
import { formatPaisa, formatYmd } from '../lib/money'
import { voidPriceSchema } from '../schemas/catalog.schema'
import type { PriceWindow } from '../types'

/**
 * Voiding is for a future price entered by mistake. It needs a reason
 * (kept in the price's history); the price before it carries on.
 */
export function VoidPriceDialog({
  price,
  onOpenChange,
  onConfirm,
}: {
  price: PriceWindow | null
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: { reason: '' },
    validators: { onChange: voidPriceSchema, onSubmit: voidPriceSchema },
    onSubmit: async ({ value }) => {
      await onConfirm(value.reason.trim())
      onOpenChange(false)
    },
  })
  useEffect(() => {
    if (price) form.reset({ reason: '' })
  }, [price, form])

  return (
    <Dialog
      open={!!price}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void this price?</DialogTitle>
          <DialogDescription>
            {price &&
              `${formatPaisa(price.unitPricePaisa, price.currency)} from ${formatYmd(price.effectiveFrom)} will never apply. `}
            The price before it keeps running. This can't be undone.
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
                htmlFor="void-reason"
                required
                error={fieldError(f)}
              >
                <Textarea
                  id="void-reason"
                  rows={3}
                  autoFocus
                  placeholder="e.g. Entered the wrong amount"
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
                Void price
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
