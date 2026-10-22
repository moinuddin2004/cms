import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/features/queue/utils/fieldError'
import { useAccess } from '@/features/access'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { editChargeSchema, toAmount } from '../../schemas/billing.schema'
import type { EditChargeValues } from '../../schemas/billing.schema'
import { chargesApi } from '../../services/billing-v2.api'
import type { Charge } from '../../types/billing.types'

/**
 * Quantity / price of an unbilled charge. Without `billing.price.override`
 * only "Other" charges or ones that still need a price can be priced (D5);
 * the field is read-only otherwise and the server enforces the same rule.
 */
export function EditChargeSheet({
  charge,
  open,
  onOpenChange,
}: {
  charge: Charge | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = useAccess()
  const canPrice =
    !!charge &&
    (can('billing.price.override') || !charge.serviceId || charge.needsPricing)
  const save = useBillingMutation(
    (v: EditChargeValues) =>
      chargesApi.update((charge as Charge).id, {
        quantity: v.quantity,
        ...(canPrice ? { unitPrice: toAmount(v.unitPrice) } : {}),
      }),
    { success: 'Charge updated' },
  )
  const form = useForm({
    defaultValues: { quantity: 1, unitPrice: '0' } as EditChargeValues,
    validators: { onChange: editChargeSchema, onSubmit: editChargeSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open && charge)
      form.reset({
        quantity: charge.quantity,
        unitPrice: String(charge.unitPrice),
      })
  }, [open, charge, form])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit charge"
      description={charge?.description}
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
          >
            {([canSubmit, isSubmitting, isDirty]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || !isDirty}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        <form.Field name="quantity">
          {(field) => (
            <FieldWrapper
              label="Quantity"
              htmlFor="edit-qty"
              error={fieldError(field)}
            >
              <Input
                id="edit-qty"
                type="number"
                min={1}
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                onBlur={field.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="unitPrice">
          {(field) => (
            <FieldWrapper
              label="Unit price (Rs)"
              htmlFor="edit-price"
              error={fieldError(field)}
              hint={
                canPrice
                  ? undefined
                  : 'Catalog price — give a discount instead.'
              }
            >
              <Input
                id="edit-price"
                inputMode="decimal"
                className="tabular-nums"
                disabled={!canPrice}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>
    </FormSheet>
  )
}
