import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWrapper,
  FormSection,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { MultiSelect } from '@/components/shared/MultiSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { fieldError } from '@/features/queue'
import {
  emptyTemplateItem,
  useOrderTemplateForm,
} from '../hooks/useOrderTemplateForm'
import { useClinicForms, useClinicServices } from '../hooks/useClinicCatalog'
import { formatPaisa } from '../lib/money'
import type { ClinicServiceRow, CurrentForm, OrderTemplate } from '../types'
import { TemplateAnswerFields } from './TemplateAnswerFields'

/**
 * Create or edit an order template: one lab, one or more services with
 * options, quantity, rush and form pre-fill. Clinic admins can share it
 * with every doctor.
 */
export function OrderTemplateSheet({
  open,
  onOpenChange,
  template,
  canShare,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: OrderTemplate | null
  canShare: boolean
}) {
  const { form, isEditing } = useOrderTemplateForm({
    open,
    template,
    onDone: () => onOpenChange(false),
  })
  const services = useClinicServices({ page: 1, limit: 100 }, open)
  const forms = useClinicForms(open)
  const byId = new Map(
    (services.data?.data ?? []).map((s) => [s.id, s] as const),
  )

  const serviceOptions = (labId: string | null) =>
    (services.data?.data ?? [])
      .filter((s) => !labId || s.lab.id === labId)
      .map((s) => ({
        value: s.id,
        label: `${s.name} · ${s.lab.name}${
          s.price ? ` — ${formatPaisa(s.price.unitPricePaisa)}` : ''
        }`,
      }))

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? 'Edit template' : 'New order template'}
      description="Start a lab order from this in a few taps. All services go to one lab; teeth and shade can be filled in when ordering."
      widthClassName="sm:max-w-2xl"
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
                {isEditing ? 'Save template' : 'Create template'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormSection title="Template">
          <div className="space-y-4">
            <form.Field name="name">
              {(f) => (
                <FieldWrapper
                  label="Name"
                  htmlFor="tpl-name"
                  required
                  error={fieldError(f)}
                >
                  <Input
                    id="tpl-name"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="e.g. Zirconia crown — A2"
                  />
                </FieldWrapper>
              )}
            </form.Field>
            {canShare && (
              <form.Field name="shared">
                {(f) => (
                  <FieldWrapper
                    label="Share with the whole clinic"
                    htmlFor="tpl-shared"
                    hint="Every doctor sees shared templates; only admins change them."
                  >
                    <Switch
                      id="tpl-shared"
                      checked={f.state.value}
                      onCheckedChange={f.handleChange}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            )}
          </div>
        </FormSection>

        <form.Field name="items" mode="array">
          {(items) => {
            const firstLab =
              byId.get(items.state.value[0]?.labServiceId ?? '')?.lab.id ?? null
            return (
              <FormSection title="Services">
                <div className="space-y-4">
                  {items.state.value.map((_, i) => (
                    <ItemFields
                      key={i}
                      index={i}
                      form={form}
                      byId={byId}
                      formsLoading={forms.isLoading}
                      forms={forms.data ?? []}
                      options={serviceOptions(i === 0 ? null : firstLab)}
                      onRemove={
                        items.state.value.length > 1
                          ? () => items.removeValue(i)
                          : undefined
                      }
                    />
                  ))}
                  {fieldError(items) && (
                    <p className="text-sm text-destructive">
                      {fieldError(items)}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={items.state.value.length >= 20}
                    onClick={() => items.pushValue(emptyTemplateItem())}
                  >
                    <Plus className="size-3.5" /> Add service
                  </Button>
                </div>
              </FormSection>
            )
          }}
        </form.Field>

        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="Notes for the lab"
              htmlFor="tpl-notes"
              error={fieldError(f)}
            >
              <Textarea
                id="tpl-notes"
                rows={2}
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

function ItemFields({
  index: i,
  form,
  byId,
  forms,
  formsLoading,
  options,
  onRemove,
}: {
  index: number
  form: ReturnType<typeof useOrderTemplateForm>['form']
  byId: Map<string, ClinicServiceRow>
  forms: CurrentForm[]
  formsLoading: boolean
  options: { value: string; label: string }[]
  onRemove?: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-2">
        <form.Field name={`items[${i}].labServiceId`}>
          {(f) => (
            <FormSelect
              containerClassName="flex-1"
              label={`Service ${i + 1}`}
              required
              placeholder="Choose a lab service"
              value={f.state.value}
              onValueChange={(v) => {
                f.handleChange(v)
                // Options and answers belong to the previous service.
                form.setFieldValue(`items[${i}].optionIds`, [])
                form.setFieldValue(`items[${i}].answers`, {})
              }}
              options={options}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        {onRemove && (
          <TooltipButton
            tooltip="Remove this service"
            variant="ghost"
            size="icon"
            className="mt-6 size-9 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </TooltipButton>
        )}
      </div>

      <form.Subscribe selector={(s) => s.values.items[i]?.labServiceId}>
        {(serviceId) => {
          const service = serviceId ? byId.get(serviceId) : undefined
          if (!service) return null
          const formDef = service.formSchema
            ? forms.find((x) => x.code === service.formSchema!.code)
            : undefined
          return (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto]">
                <form.Field name={`items[${i}].optionIds`}>
                  {(f) => (
                    <FieldWrapper label="Options" htmlFor={`tpl-${i}-options`}>
                      <MultiSelect
                        id={`tpl-${i}-options`}
                        aria-label="Options"
                        placeholder={
                          service.options.length ? 'None' : 'No options'
                        }
                        disabled={!service.options.length}
                        options={service.options.map((o) => ({
                          value: o.id,
                          label: `${o.name} (+${formatPaisa(o.extraCostPaisa)})`,
                        }))}
                        value={f.state.value}
                        onChange={f.handleChange}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name={`items[${i}].quantity`}>
                  {(f) => (
                    <FieldWrapper
                      label="Qty"
                      htmlFor={`tpl-${i}-qty`}
                      error={fieldError(f)}
                    >
                      <Input
                        id={`tpl-${i}-qty`}
                        inputMode="numeric"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name={`items[${i}].rush`}>
                  {(f) => (
                    <FieldWrapper label="Rush" htmlFor={`tpl-${i}-rush`}>
                      <Switch
                        id={`tpl-${i}-rush`}
                        checked={f.state.value}
                        onCheckedChange={f.handleChange}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              </div>
              {service.formSchema && (
                <form.Field name={`items[${i}].answers`}>
                  {(f) =>
                    formsLoading ? (
                      <p className="text-xs text-text-3">Loading form…</p>
                    ) : formDef ? (
                      <TemplateAnswerFields
                        idPrefix={`tpl-${i}`}
                        fields={formDef.schemaJson.fields}
                        value={f.state.value}
                        onChange={f.handleChange}
                      />
                    ) : (
                      <p className="text-xs text-text-3">
                        The {service.formSchema!.name} form isn't available to
                        your clinic.
                      </p>
                    )
                  }
                </form.Field>
              )}
            </div>
          )
        }}
      </form.Subscribe>
    </div>
  )
}
