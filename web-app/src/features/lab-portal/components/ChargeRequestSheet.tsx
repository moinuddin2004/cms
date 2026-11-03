import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NumberInput } from '@/components/forms/NumberInput'
import { fieldError } from '@/components/forms/fieldError'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { useChargeRequestForm } from '../hooks/useChargeRequestForm'
import type { ChargeKind, ChargeRequestInput, PortalOrderItem } from '../types'

export const CHARGE_KIND_LABEL: Record<ChargeKind, string> = {
  rush: 'Rush',
  material: 'Extra material',
  shipping: 'Shipping',
  other: 'Other',
}
const KINDS = (Object.keys(CHARGE_KIND_LABEL) as ChargeKind[]).map((value) => ({
  value,
  label: CHARGE_KIND_LABEL[value],
}))
const WHOLE_ORDER = '__order'

/**
 * A lab admin asks the clinic for an extra charge (lab ERD §6). The clinic
 * approves or rejects it on its order page; an approved item charge is
 * added to that item's lab cost.
 */
export function ChargeRequestSheet({
  open,
  items,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  items: PortalOrderItem[]
  onOpenChange: (open: boolean) => void
  onSubmit: (body: ChargeRequestInput) => Promise<unknown>
}) {
  const form = useChargeRequestForm({
    open,
    onSubmit: async (body) => {
      await onSubmit(body)
      onOpenChange(false)
    },
  })
  const itemOptions = [
    { value: WHOLE_ORDER, label: 'Whole order' },
    ...items.map((i) => ({
      value: i.id,
      label: `${i.lineNo}. ${i.serviceName ?? ''}`,
    })),
  ]
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Request an extra charge"
      description="The clinic approves or rejects it before it is billed."
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Send request
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="kind">
          {(f) => (
            <FormSelect
              label="Type"
              required
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as ChargeKind)}
              options={KINDS}
            />
          )}
        </form.Field>
        <form.Field name="itemId">
          {(f) => (
            <FormSelect
              label="For"
              value={f.state.value || WHOLE_ORDER}
              onValueChange={(v) => f.handleChange(v === WHOLE_ORDER ? '' : v)}
              options={itemOptions}
            />
          )}
        </form.Field>
        <form.Field name="amount">
          {(f) => (
            <FieldWrapper
              label="Amount"
              htmlFor="charge-amount"
              required
              error={fieldError(f)}
            >
              <NumberInput
                id="charge-amount"
                mode="decimal"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="reason">
          {(f) => (
            <FieldWrapper
              label="Reason"
              htmlFor="charge-reason"
              required
              error={fieldError(f)}
            >
              <Textarea
                id="charge-reason"
                rows={3}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
