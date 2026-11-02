import { useForm, useStore } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FormSheet } from '@/components/forms/FormSheet'
import { fieldError } from '@/components/forms/fieldError'
import { moneyField, toInputValue, toNumberOrNull } from '@/lib/zod-numbers'
import { useSetPlanDiscount } from '../hooks/useTreatmentPlans'
import {
  discountKindField,
  refineDiscount,
} from '../schemas/treatmentPlan.schema'
import type { DiscountKind, TreatmentPlan } from '../types'
import { planTotals } from '../utils/planMath'
import { DiscountInputs, PlanTotalsView } from './PlanPricing'

const planDiscountSchema = z
  .object({
    discountKind: discountKindField,
    discountValue: moneyField('Discount', { required: false }),
  })
  .superRefine(refineDiscount)

/** Reception sets the whole-plan discount before treatment starts. */
export function PlanDiscountSheet({
  open,
  onOpenChange,
  patientId,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  plan: TreatmentPlan
}) {
  const save = useSetPlanDiscount(patientId)
  const form = useForm({
    defaultValues: {
      discountKind: plan.discountKind ?? ('' as const),
      discountValue: toInputValue(plan.discountValue),
    },
    validators: { onChange: planDiscountSchema, onSubmit: planDiscountSchema },
    onSubmit: ({ value }) => {
      const kind = value.discountKind || null
      save.mutate(
        {
          planId: plan.id,
          kind,
          value: kind ? toNumberOrNull(value.discountValue) : null,
        },
        { onSuccess: () => onOpenChange(false) },
      )
    },
  })
  const values = useStore(form.store, (s) => s.values)
  const totals = planTotals(
    plan.items.map((i) => i.estimatedCost),
    values.discountKind || null,
    Number(values.discountValue) || null,
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Discount — ${plan.planName}`}
      description="One discount for the whole plan. It is spread over the plan's services on its bill."
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
                Save discount
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        <form.Field name="discountKind">
          {(kindField) => (
            <form.Field name="discountValue">
              {(valueField) => (
                <div className="space-y-1.5">
                  <Label>Discount</Label>
                  <DiscountInputs
                    kind={kindField.state.value}
                    value={valueField.state.value}
                    onKindChange={(k) =>
                      kindField.handleChange(k as '' | DiscountKind)
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
        <PlanTotalsView totals={totals} />
      </div>
    </FormSheet>
  )
}
