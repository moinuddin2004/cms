import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/shared/DatePicker'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { usePriceForm } from '../hooks/usePriceForm'
import { useLabClinics } from '../hooks/usePlatformCatalog'
import { catalogToday } from '../lib/money'
import type { PriceWindow } from '../types'

const LIST = '__list__'

/**
 * Add a price window (list price or one clinic's negotiated rate), or edit
 * one. A price already in use only takes an end date.
 */
export function ServicePriceSheet({
  open,
  onOpenChange,
  labId,
  serviceId,
  serviceName,
  price,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labId: string
  serviceId: string
  serviceName: string
  price: PriceWindow | null
}) {
  const { form, isEditing, started } = usePriceForm({
    open,
    labId,
    serviceId,
    price,
    organizationId: '',
    onDone: () => onOpenChange(false),
  })
  const clinics = useLabClinics(labId, open && !isEditing)
  const today = catalogToday()
  const clinicOptions = [
    { value: LIST, label: 'List price (every clinic)' },
    ...(clinics.data ?? []).map((k) => ({
      value: k.organization.id,
      label: k.organization.name,
    })),
  ]

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? 'Edit price' : 'Add price'}
      description={
        started
          ? 'This price is in use — you can only set when it ends. Add a new price for a new amount.'
          : `${serviceName}. A clinic's own rate wins over the list price on the days both apply.`
      }
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
                disabled={!canSubmit || isSubmitting || (isEditing && !isDirty)}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? 'Save price' : 'Add price'}
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
        <form.Field name="organizationId">
          {(f) =>
            isEditing ? (
              <FieldWrapper label="Applies to">
                <p className="text-sm">
                  {price?.organization?.name ?? 'List price (every clinic)'}
                </p>
              </FieldWrapper>
            ) : (
              <FormSelect
                label="Applies to"
                required
                value={f.state.value || LIST}
                onValueChange={(v) => f.handleChange(v === LIST ? '' : v)}
                options={clinicOptions}
                hint="Only clinics on this lab's client list can get their own rate."
              />
            )
          }
        </form.Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="unitPrice">
            {(f) => (
              <FieldWrapper
                label="Price per unit (PKR)"
                htmlFor="price-unit"
                required
                error={fieldError(f)}
              >
                <Input
                  id="price-unit"
                  inputMode="decimal"
                  disabled={started}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="rushSurcharge">
            {(f) => (
              <FieldWrapper
                label="Rush surcharge (PKR)"
                htmlFor="price-rush"
                error={fieldError(f)}
              >
                <Input
                  id="price-rush"
                  inputMode="decimal"
                  disabled={started}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                  placeholder="0"
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="effectiveFrom">
            {(f) => (
              <FieldWrapper
                label="From"
                htmlFor="price-from"
                required
                error={fieldError(f)}
              >
                <DatePicker
                  id="price-from"
                  value={f.state.value}
                  min={today}
                  disabled={started}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="effectiveTo">
            {(f) => (
              <FieldWrapper
                label="Until"
                htmlFor="price-to"
                hint="Leave empty to keep it running."
                error={fieldError(f)}
              >
                <DatePicker
                  id="price-to"
                  value={f.state.value}
                  clearable
                  placeholder="No end date"
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="Note"
              htmlFor="price-notes"
              error={fieldError(f)}
            >
              <Input
                id="price-notes"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                placeholder="e.g. Rate agreed on WhatsApp, Oct 2026"
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
