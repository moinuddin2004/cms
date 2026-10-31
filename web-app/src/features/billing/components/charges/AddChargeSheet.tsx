import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { toNumber } from '@/lib/zod-numbers'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { OptionSelect } from '../shared/OptionSelect'
import { fieldError } from '@/features/queue/utils/fieldError'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { useCatalogServices } from '../../hooks/use-billing-queries'
import { manualChargeSchema, toAmount } from '../../schemas/billing.schema'
import type { ManualChargeValues } from '../../schemas/billing.schema'
import { chargesApi } from '../../services/billing-v2.api'

const EMPTY: ManualChargeValues = {
  kind: 'service',
  serviceId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
}

/** Add a catalog service or an "Other" charge (free text + price) — plan §8.2.3. */
export function AddChargeSheet({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const services = useCatalogServices({ activeOnly: true })
  const add = useBillingMutation(
    (v: ManualChargeValues) =>
      chargesApi.addManual(patientId, {
        quantity: toNumber(v.quantity),
        ...(v.kind === 'service'
          ? { serviceId: v.serviceId }
          : {
              description: v.description.trim(),
              unitPrice: toAmount(v.unitPrice),
            }),
      }),
    { success: 'Charge added' },
  )
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onChange: manualChargeSchema, onSubmit: manualChargeSchema },
    onSubmit: async ({ value }) => {
      await add.mutateAsync(value)
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const options = (services.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} · ${formatCurrency(s.defaultPrice)}`,
  }))

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add charge"
      description="Catalog services are priced automatically for this location."
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
                Add charge
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        <form.Field name="kind">
          {(field) => (
            <div
              className="flex overflow-hidden rounded-lg border border-border text-xs"
              role="radiogroup"
            >
              {(['service', 'other'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={field.state.value === k}
                  onClick={() => field.handleChange(k)}
                  className={cn(
                    'flex-1 px-3 py-2 transition-colors',
                    field.state.value === k
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {k === 'service' ? 'Catalog service' : 'Other'}
                </button>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.kind}>
          {(kind) =>
            kind === 'service' ? (
              <form.Field name="serviceId">
                {(field) => (
                  <FieldWrapper
                    label="Service"
                    required
                    error={fieldError(field)}
                  >
                    <OptionSelect
                      options={options}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      placeholder={
                        services.isLoading ? 'Loading…' : 'Search services'
                      }
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            ) : (
              <>
                <form.Field name="description">
                  {(field) => (
                    <FieldWrapper
                      label="Description"
                      htmlFor="charge-desc"
                      required
                      error={fieldError(field)}
                    >
                      <Input
                        id="charge-desc"
                        dir="auto"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name="unitPrice">
                  {(field) => (
                    <FieldWrapper
                      label="Price (Rs)"
                      htmlFor="charge-price"
                      required
                      error={fieldError(field)}
                    >
                      <NumberInput
                        id="charge-price"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              </>
            )
          }
        </form.Subscribe>

        <form.Field name="quantity">
          {(field) => (
            <FieldWrapper
              label="Quantity"
              htmlFor="charge-qty"
              error={fieldError(field)}
            >
              <NumberInput
                mode="integer"
                id="charge-qty"
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
