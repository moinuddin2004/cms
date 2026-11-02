import { useMemo } from 'react'
import { useStore } from '@tanstack/react-form'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/forms/FormSheet'
import { FormSelect } from '@/components/forms/FormSelect'
import { NumberInput } from '@/components/forms/NumberInput'
import { fieldError } from '@/components/forms/fieldError'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useAccess } from '@/features/access/hooks/useAccess'
import { usePlanTemplates } from '@/features/plan-templates/hooks/usePlanTemplates'
import type { PlanTemplate } from '@/features/plan-templates/types'
import { formatCurrency } from '@/lib/formatters'
import { toInputValue } from '@/lib/zod-numbers'
import {
  useSaveTreatmentPlan,
  useServiceCatalog,
} from '../hooks/useTreatmentPlans'
import {
  emptyPlanLine,
  useTreatmentPlanForm,
} from '../hooks/useTreatmentPlanForm'
import type { TreatmentPlanPrefill } from '../hooks/useTreatmentPlanForm'
import type { PlanLineValues } from '../schemas/treatmentPlan.schema'
import type { DiscountKind, ServiceOption, TreatmentPlan } from '../types'
import { planTotals } from '../utils/planMath'
import { DiscountInputs, PlanTotalsView, ServiceSelect } from './PlanPricing'

/**
 * Create / edit a patient's treatment plan: start from a template or pick
 * services, add teeth and sessions, and (with permission) see prices and
 * give one discount for the whole plan.
 */
export function TreatmentPlanSheet({
  open,
  onOpenChange,
  patientId,
  dentistId,
  encounterId,
  plan,
  prefill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  /** The visit's doctor; the plan defaults to them. */
  dentistId: string | null
  /** The visit the plan is made in; completing it bills the plan. */
  encounterId?: string
  plan: TreatmentPlan | null
  /** Starting lines / notes for a new plan. */
  prefill?: TreatmentPlanPrefill
}) {
  const { can } = useAccess()
  const canSeePrices = can('patients.price.view')
  const canDiscount = canSeePrices && can('billing.discount.apply')
  // Priced for the plan's doctor, the same way the server locks the price.
  const { data: services = [] } = useServiceCatalog(
    plan?.dentistId ?? dentistId,
  )
  const { data: templates = [] } = usePlanTemplates()
  const save = useSaveTreatmentPlan(patientId)

  const form = useTreatmentPlanForm({
    plan,
    prefill,
    canDiscount,
    onSubmit: (input) =>
      save.mutate(
        {
          planId: plan?.id ?? null,
          input: {
            ...input,
            dentistId: plan ? undefined : (dentistId ?? undefined),
            encounterId: plan ? undefined : encounterId,
          },
        },
        { onSuccess: () => onOpenChange(false) },
      ),
  })
  const values = useStore(form.store, (s) => s.values)

  // Accepted plans keep the agreed price of a line whose service is unchanged.
  const locked = useMemo(
    () =>
      new Map(
        plan?.patientAccepted ? plan.items.map((i) => [i.id, i] as const) : [],
      ),
    [plan],
  )
  const priceOf = (line: PlanLineValues): number | undefined => {
    const prev = line.id ? locked.get(line.id) : undefined
    if (prev && prev.serviceId === line.serviceId && prev.estimatedCost != null)
      return Number(prev.estimatedCost)
    return services.find((s) => s.id === line.serviceId)?.price
  }
  const totals = planTotals(
    values.items.map(priceOf),
    (values.discountKind || null) as DiscountKind | null,
    Number(values.discountValue) || null,
  )

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)
    form.setFieldValue('planTemplateId', t ? id : '')
    if (!t) return
    form.setFieldValue('planName', t.name)
    form.setFieldValue('items', templateLines(t, services))
    if (canDiscount) {
      form.setFieldValue('discountKind', t.discountKind ?? '')
      form.setFieldValue('discountValue', toInputValue(t.discountValue))
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? `Edit plan ${plan.planNumber}` : 'New treatment plan'}
      description="Pick the services this treatment needs. The patient gets one bill for the whole plan when this visit is completed."
      widthClassName="sm:max-w-2xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="button"
                disabled={!canSubmit || isSubmitting || save.isPending}
                onClick={() => void form.handleSubmit()}
              >
                {(isSubmitting || save.isPending) && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {plan ? 'Save plan' : 'Create plan'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        {!plan && templates.length > 0 && (
          <FormSelect
            label="Start from a template (optional)"
            placeholder="No template"
            value={values.planTemplateId}
            onValueChange={applyTemplate}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        )}

        <form.Field name="planName">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="tp-name">Plan name</Label>
              <Input
                id="tp-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g. RCT + Crown (blank = named after the services)"
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
              <Label>Services</Label>
              {items.state.value.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border p-2 sm:grid-cols-[minmax(0,1fr)_80px_72px_auto]"
                >
                  <form.Field name={`items[${i}].serviceId`}>
                    {(f) => (
                      <div className="space-y-1">
                        <ServiceSelect
                          services={services}
                          value={f.state.value}
                          onChange={(v) => f.handleChange(v)}
                          invalid={!!fieldError(f)}
                        />
                        {fieldError(f) && (
                          <p className="text-xs text-destructive">
                            {fieldError(f)}
                          </p>
                        )}
                        {canSeePrices && priceOf(line) != null && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(priceOf(line) ?? 0)}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
                    <form.Field name={`items[${i}].toothNumber`}>
                      {(f) => (
                        <Input
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                          placeholder="Tooth #"
                          aria-label="Tooth number"
                          aria-invalid={!!fieldError(f)}
                          className="h-9"
                        />
                      )}
                    </form.Field>
                    <form.Field name={`items[${i}].estimatedSessions`}>
                      {(f) => (
                        <NumberInput
                          mode="integer"
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                          placeholder="1"
                          aria-label="Sessions"
                          title="Sessions (visits)"
                          aria-invalid={!!fieldError(f)}
                          className="h-9"
                        />
                      )}
                    </form.Field>
                  </div>
                  <TooltipButton
                    type="button"
                    tooltip="Remove service"
                    variant="ghost"
                    size="icon"
                    className="row-start-1 size-9 text-destructive sm:row-auto"
                    disabled={items.state.value.length === 1}
                    onClick={() => void items.removeValue(i)}
                  >
                    <Trash2 className="size-4" />
                  </TooltipButton>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void items.pushValue(emptyPlanLine())}
              >
                <Plus className="size-3.5" /> Add service
              </Button>
              <p className="text-xs text-muted-foreground">
                Sessions = visits this service takes. Tooth is optional.
              </p>
            </div>
          )}
        </form.Field>

        {canDiscount && (
          <form.Field name="discountKind">
            {(kindField) => (
              <form.Field name="discountValue">
                {(valueField) => (
                  <div className="space-y-1.5">
                    <Label>Discount on the whole plan</Label>
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
                  </div>
                )}
              </form.Field>
            )}
          </form.Field>
        )}
        {canSeePrices && <PlanTotalsView totals={totals} />}
        {canSeePrices && !canDiscount && (
          <p className="text-xs text-muted-foreground">
            Reception can give a discount on this plan.
          </p>
        )}

        <form.Field name="notes">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="tp-notes">Notes</Label>
              <Textarea
                id="tp-notes"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="h-16 resize-none"
                placeholder="Anything to remember about this plan"
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>
    </FormSheet>
  )
}

/**
 * Template steps → plan rows. A step not linked to a service yet is matched
 * to a catalog service by name; if none matches, the doctor picks one.
 */
function templateLines(
  t: PlanTemplate,
  services: ServiceOption[],
): PlanLineValues[] {
  const byName = new Map(services.map((s) => [s.name.toLowerCase(), s.id]))
  const known = new Set(services.map((s) => s.id))
  return t.items.map((step) => ({
    id: '',
    serviceId:
      step.serviceId && known.has(step.serviceId)
        ? step.serviceId
        : (byName.get(step.procedureName.toLowerCase()) ?? ''),
    toothNumber: '',
    estimatedSessions: toInputValue(step.estimatedSessions),
  }))
}
