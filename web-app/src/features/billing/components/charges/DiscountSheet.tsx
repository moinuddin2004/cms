import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/features/queue/utils/fieldError'
import { useAccess } from '@/features/access'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { useDiscountTypes } from '../../hooks/use-billing-queries'
import { discountSchema } from '../../schemas/billing.schema'
import type { DiscountValues } from '../../schemas/billing.schema'
import { chargesApi } from '../../services/billing-v2.api'
import type { DiscountInput } from '../../services/billing-v2.api'
import type { DiscountType } from '../../types/billing.types'
import { OptionSelect } from '../shared/OptionSelect'

const EMPTY: DiscountValues = {
  discountTypeId: '',
  custom: false,
  kind: 'PERCENTAGE',
  value: '',
  note: '',
}

const label = (t: DiscountType) =>
  `${t.name} · ${t.kind === 'PERCENTAGE' ? `${t.value}%` : `Rs ${t.value}`}`

export function toDiscountInput(
  v: DiscountValues,
  type: DiscountType | undefined,
): DiscountInput {
  if (v.custom)
    return { kind: v.kind, value: Number(v.value), note: v.note.trim() }
  const value = v.value === '' ? undefined : Number(v.value)
  return {
    discountTypeId: v.discountTypeId,
    ...(value !== undefined && value !== type?.value ? { value } : {}),
    ...(v.note.trim() ? { note: v.note.trim() } : {}),
  }
}

/**
 * Apply one discount to one charge, or to every selected unbilled charge
 * ("apply to all", plan §8.2.4). Only types usable today are offered;
 * custom discounts and values outside a preset's range need
 * `billing.discount.custom` (D8). The server validates everything.
 */
export function DiscountSheet({
  chargeIds,
  open,
  onOpenChange,
}: {
  chargeIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = useAccess()
  const canCustom = can('billing.discount.custom')
  const types = useDiscountTypes(true, open)
  const apply = useBillingMutation(async (input: DiscountInput) => {
    if (chargeIds.length === 1) {
      await chargesApi.setDiscount(chargeIds[0], input)
      return []
    }
    const res = await chargesApi.bulkDiscount({ ...input, chargeIds })
    return res.skipped
  })

  const form = useForm({
    defaultValues: EMPTY,
    validators: { onChange: discountSchema, onSubmit: discountSchema },
    onSubmit: async ({ value }) => {
      const type = types.data?.find((t) => t.id === value.discountTypeId)
      const skipped = await apply.mutateAsync(toDiscountInput(value, type))
      if (skipped.length)
        toast.warning(
          `Not applied to: ${skipped.map((s) => s.description).join(', ')}`,
        )
      else toast.success('Discount applied')
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const valueField = (fieldLabel: string, placeholder?: string) => (
    <form.Field name="value">
      {(field) => (
        <FieldWrapper
          label={fieldLabel}
          htmlFor="discount-value"
          error={fieldError(field)}
        >
          <Input
            id="discount-value"
            inputMode="decimal"
            className="tabular-nums"
            placeholder={placeholder}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        chargeIds.length > 1
          ? `Discount ${chargeIds.length} charges`
          : 'Discount'
      }
      description="One discount per charge — a new one replaces the old."
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
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Apply discount
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        {canCustom && (
          <form.Field name="custom">
            {(field) => (
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Custom discount</span>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  aria-label="Custom discount"
                />
              </label>
            )}
          </form.Field>
        )}
        <form.Subscribe
          selector={(s) => [s.values.custom, s.values.discountTypeId] as const}
        >
          {([custom, typeId]) => {
            const type = types.data?.find((t) => t.id === typeId)
            return custom ? (
              <>
                <form.Field name="kind">
                  {(field) => (
                    <FieldWrapper label="Kind">
                      <OptionSelect
                        options={[
                          { value: 'PERCENTAGE', label: 'Percentage' },
                          { value: 'FIXED', label: 'Fixed amount' },
                        ]}
                        value={field.state.value}
                        onChange={(v) =>
                          field.handleChange(v as DiscountValues['kind'])
                        }
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                {valueField('Value')}
              </>
            ) : (
              <>
                <form.Field name="discountTypeId">
                  {(field) => (
                    <FieldWrapper
                      label="Discount"
                      required
                      error={fieldError(field)}
                    >
                      <OptionSelect
                        options={(types.data ?? []).map((t) => ({
                          value: t.id,
                          label: label(t),
                        }))}
                        value={field.state.value}
                        onChange={(v) => field.handleChange(v)}
                        placeholder={
                          types.isLoading ? 'Loading…' : 'Choose a discount'
                        }
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                {type &&
                  (type.receptionEditable || canCustom) &&
                  valueField(
                    type.receptionEditable && !canCustom
                      ? `Value (${type.minValue}–${type.maxValue})`
                      : 'Value (optional)',
                    String(type.value),
                  )}
              </>
            )
          }}
        </form.Subscribe>
        <form.Field name="note">
          {(field) => (
            <FieldWrapper
              label="Note"
              htmlFor="discount-note"
              error={fieldError(field)}
            >
              <Textarea
                id="discount-note"
                dir="auto"
                rows={2}
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
