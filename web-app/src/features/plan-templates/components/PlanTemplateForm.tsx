import { useMemo } from 'react'
import { useStore } from '@tanstack/react-form'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { FormSelect } from '@/components/forms/FormSelect'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { useAccess } from '@/features/access/hooks/useAccess'
import {
  DiscountInputs,
  PlanTotalsView,
  ServiceSelect,
  planTotals,
  useServiceCatalog,
} from '@/features/treatment-plans'
import type { DiscountKind, ServiceOption } from '@/features/treatment-plans'
import { PLAN_TEMPLATE_CATEGORY_OPTIONS } from '../types'
import type {
  PlanTemplate,
  PlanTemplateCategory,
  PlanTemplateInput,
} from '../types'
import {
  emptyPlanTemplateItem,
  usePlanTemplateForm,
} from '../hooks/usePlanTemplateForm'

/**
 * Create / edit one treatment plan template: the services a treatment needs
 * (prices from the catalog) and an optional discount every plan made from it
 * starts with.
 */
export function PlanTemplateForm({
  template,
  isPending,
  onSubmit,
  onCancel,
}: {
  template: PlanTemplate | null
  isPending: boolean
  onSubmit: (input: PlanTemplateInput) => void
  onCancel: () => void
}) {
  const { can } = useAccess()
  const canSeePrices = can('patients.price.view')
  const { data: services = [], isLoading } = useServiceCatalog()
  const serviceIdByName = useMemo(
    () => new Map(services.map((s) => [s.name.toLowerCase(), s.id])),
    [services],
  )

  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Loading services…
      </p>
    )
  }
  return (
    <TemplateFormBody
      template={template}
      isPending={isPending}
      onSubmit={onSubmit}
      onCancel={onCancel}
      services={services}
      serviceIdByName={serviceIdByName}
      canSeePrices={canSeePrices}
    />
  )
}

/** Mounted once the catalog is in, so unlinked steps can be matched by name. */
function TemplateFormBody({
  template,
  isPending,
  onSubmit,
  onCancel,
  services,
  serviceIdByName,
  canSeePrices,
}: {
  template: PlanTemplate | null
  isPending: boolean
  onSubmit: (input: PlanTemplateInput) => void
  onCancel: () => void
  services: ServiceOption[]
  serviceIdByName: Map<string, string>
  canSeePrices: boolean
}) {
  const form = usePlanTemplateForm({ template, serviceIdByName, onSubmit })
  const values = useStore(form.store, (s) => s.values)
  const totals = planTotals(
    values.items.map((i) => services.find((s) => s.id === i.serviceId)?.price),
    (values.discountKind || null) as DiscountKind | null,
    Number(values.discountValue) || null,
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pt-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pt-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g. RCT + Crown"
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="category">
          {(field) => (
            <FormSelect
              label="Category"
              value={field.state.value}
              onValueChange={(v) =>
                field.handleChange(v as PlanTemplateCategory)
              }
              options={PLAN_TEMPLATE_CATEGORY_OPTIONS}
            />
          )}
        </form.Field>
      </div>

      <form.Field name="description">
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="pt-desc">Description</Label>
            <Textarea
              id="pt-desc"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              className="h-16 resize-none"
              placeholder="What this plan covers"
            />
            {fieldError(field) && (
              <p className="text-xs text-destructive">{fieldError(field)}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="items" mode="array">
        {(items) => (
          <div className="space-y-2">
            <Label>Services, in order</Label>
            {services.length === 0 && (
              <p className="text-xs text-destructive">
                The clinic has no procedures in its service catalog yet. Add
                them under Billing settings first.
              </p>
            )}
            {items.state.value.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_minmax(0,1fr)_72px_auto] items-start gap-2 rounded-md border border-border p-2"
              >
                <span className="pt-2 font-mono text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <form.Field name={`items[${i}].serviceId`}>
                  {(f) => (
                    <div className="min-w-0 space-y-1">
                      <ServiceSelect
                        services={services}
                        value={f.state.value}
                        onChange={(v) => f.handleChange(v)}
                        invalid={!!fieldError(f)}
                      />
                      {!f.state.value && row.procedureName && (
                        <p className="text-xs text-muted-foreground">
                          Was “{row.procedureName}” — pick the matching service.
                        </p>
                      )}
                      {fieldError(f) && (
                        <p className="text-xs text-destructive">
                          {fieldError(f)}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
                <form.Field name={`items[${i}].estimatedSessions`}>
                  {(f) => (
                    <div className="space-y-1">
                      <NumberInput
                        mode="integer"
                        placeholder="1"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                        aria-label="Sessions"
                        title="Sessions (visits)"
                        aria-invalid={!!fieldError(f)}
                        className="h-9"
                      />
                      {fieldError(f) && (
                        <p className="text-xs text-destructive">
                          {fieldError(f)}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
                <div className="flex">
                  <TooltipButton
                    type="button"
                    tooltip="Move up"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={i === 0}
                    onClick={() => void items.moveValue(i, i - 1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </TooltipButton>
                  <TooltipButton
                    type="button"
                    tooltip="Move down"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={i === items.state.value.length - 1}
                    onClick={() => void items.moveValue(i, i + 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </TooltipButton>
                  <TooltipButton
                    type="button"
                    tooltip="Remove service"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    disabled={items.state.value.length === 1}
                    onClick={() => void items.removeValue(i)}
                  >
                    <Trash2 className="size-3.5" />
                  </TooltipButton>
                </div>
              </div>
            ))}
            {listError(items) && (
              <p className="text-xs text-destructive">{listError(items)}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void items.pushValue(emptyPlanTemplateItem())}
            >
              <Plus className="size-3.5" /> Add service
            </Button>
            <p className="text-xs text-muted-foreground">
              Prices come from the service catalog, so the template stays right
              when a fee changes. Sessions = visits the service takes.
            </p>
          </div>
        )}
      </form.Field>

      {canSeePrices && (
        <>
          <form.Field name="discountKind">
            {(kindField) => (
              <form.Field name="discountValue">
                {(valueField) => (
                  <div className="space-y-1.5">
                    <Label>Discount (optional)</Label>
                    <DiscountInputs
                      kind={kindField.state.value}
                      value={valueField.state.value}
                      onKindChange={(k) =>
                        kindField.handleChange(k as '' | 'PERCENTAGE' | 'FIXED')
                      }
                      onValueChange={(v) => valueField.handleChange(v)}
                      onBlur={valueField.handleBlur}
                      error={fieldError(valueField)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Every plan made from this template starts with it.
                    </p>
                  </div>
                )}
              </form.Field>
            )}
          </form.Field>
          <PlanTotalsView totals={totals} />
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || isPending}
            >
              {(isSubmitting || isPending) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {template ? 'Save changes' : 'Create template'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

/**
 * The list-level error ("Add at least one service"). The list has no input
 * of its own, so it shows once anything in the form was touched — otherwise
 * Save could be disabled with no reason given.
 */
function listError(items: {
  state: { meta: { errors: unknown[] } }
  form: { state: { isTouched: boolean; submissionAttempts: number } }
}) {
  return fieldError({
    state: {
      meta: {
        errors: items.state.meta.errors,
        isTouched: items.form.state.isTouched,
      },
    },
    form: items.form,
  })
}
