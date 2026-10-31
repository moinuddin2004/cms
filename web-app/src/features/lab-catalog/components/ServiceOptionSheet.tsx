import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useServiceOptionForm } from '../hooks/useServiceOptionForm'
import { OPTION_TYPE_LABEL } from '../types'
import type { OptionType, ServiceOption } from '../types'
import { activeCurrency } from '@/lib/currency'

const TYPE_OPTIONS = (Object.keys(OPTION_TYPE_LABEL) as OptionType[]).map(
  (t) => ({ value: t, label: OPTION_TYPE_LABEL[t] }),
)

/** Add or edit a material / variant of a lab service. */
export function ServiceOptionSheet({
  open,
  onOpenChange,
  labId,
  serviceId,
  option,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labId: string
  serviceId: string
  option: ServiceOption | null
}) {
  const { form, isEditing } = useServiceOptionForm({
    open,
    labId,
    serviceId,
    option,
    onDone: () => onOpenChange(false),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? 'Edit option' : 'Add option'}
      description="The extra cost is added to the service price for every unit with this option."
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
                {isEditing ? 'Save option' : 'Add option'}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="optionType">
            {(f) => (
              <FormSelect
                label="Type"
                required
                disabled={isEditing}
                value={f.state.value}
                onValueChange={(v) => f.handleChange(v as OptionType)}
                options={TYPE_OPTIONS}
              />
            )}
          </form.Field>
          <form.Field name="code">
            {(f) => (
              <FieldWrapper
                label="Code"
                htmlFor="opt-code"
                required
                error={fieldError(f)}
              >
                <Input
                  id="opt-code"
                  disabled={isEditing}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                  className="uppercase"
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="name">
          {(f) => (
            <FieldWrapper
              label="Name"
              htmlFor="opt-name"
              required
              error={fieldError(f)}
            >
              <Input
                id="opt-name"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                placeholder="e.g. Layered porcelain"
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="extraCost">
          {(f) => (
            <FieldWrapper
              label={`Extra cost per unit (${activeCurrency()})`}
              htmlFor="opt-cost"
              required
              error={fieldError(f)}
            >
              <NumberInput
                id="opt-cost"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                placeholder="0"
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
