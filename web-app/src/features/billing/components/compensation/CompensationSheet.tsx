import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/forms/NumberInput'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { DatePicker } from '@/components/shared/DatePicker'
import { fieldError } from '@/features/queue/utils/fieldError'
import { cn } from '@/lib/utils'
import {
  useAddCompensationPlan,
  useReplaceCommissionRules,
} from '../../hooks/use-commissions'
import { bpsToPercent, paisaToRupeesText } from '../../lib/commission-math'
import {
  compensationSchema,
  rulesOnlySchema,
  toPlanInput,
  toRuleInputs,
} from '../../schemas/commission.schema'
import type {
  CompensationValues,
  RuleRow,
  RulesOnlyValues,
} from '../../schemas/commission.schema'
import type {
  CompensationPlan,
  CompensationPlanType,
} from '../../types/commission.types'
import { CommissionRulesEditor } from './CommissionRulesEditor'

export const PLAN_TYPE_LABEL: Record<CompensationPlanType, string> = {
  SALARY: 'Salaried',
  COMMISSION: 'Commission',
  SALARY_PLUS_COMMISSION: 'Both',
}

export function rowsFromPlan(plan: CompensationPlan | null): RuleRow[] {
  return (plan?.rules ?? []).map((r) => ({
    target: r.serviceId ? `svc:${r.serviceId}` : `cat:${r.serviceCategory}`,
    mode: r.rateBps !== null ? 'percent' : 'fixed',
    value:
      r.rateBps !== null
        ? bpsToPercent(r.rateBps)
        : paisaToRupeesText(r.fixedAmountPaisa ?? 0),
  }))
}

function UnsavedNote({ dirty }: { dirty: boolean }) {
  return dirty ? (
    <span className="mr-auto self-center text-xs text-amber">
      Unsaved changes
    </span>
  ) : null
}

/** New compensation version: type, salary, default %, basis, overrides, start date. */
export function CompensationSheet({
  assignmentId,
  current,
  canConsult,
  today,
  open,
  onOpenChange,
}: {
  assignmentId: string
  current: CompensationPlan | null
  canConsult: boolean
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useAddCompensationPlan(assignmentId)
  const initial = (): CompensationValues => ({
    type: current?.type ?? 'SALARY',
    salary:
      current?.baseSalaryPaisa != null
        ? paisaToRupeesText(current.baseSalaryPaisa)
        : '',
    rate:
      current?.defaultRateBps != null
        ? bpsToPercent(current.defaultRateBps)
        : '',
    basis: current?.commissionBasis ?? 'NET',
    effectiveFrom: today,
    rules: rowsFromPlan(current),
  })
  const form = useForm({
    defaultValues: initial(),
    validators: { onChange: compensationSchema, onSubmit: compensationSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(toPlanInput(value))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset(initial())
  }, [open])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Change compensation"
      description="Saves a new version from the chosen date. Charges already created keep the rate they were made with."
      footer={
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
        >
          {([canSubmit, isSubmitting, isDirty]) => (
            <>
              <UnsavedNote dirty={isDirty} />
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save version
              </Button>
            </>
          )}
        </form.Subscribe>
      }
    >
      <div className="space-y-5">
        <form.Field name="type">
          {(field) => (
            <FieldWrapper
              label="How is this person paid?"
              hint={
                canConsult
                  ? undefined
                  : 'Commission needs a role that can consult patients.'
              }
            >
              <div
                className="flex overflow-hidden rounded-lg border border-border text-sm"
                role="radiogroup"
                aria-label="Plan type"
              >
                {(Object.keys(PLAN_TYPE_LABEL) as CompensationPlanType[]).map(
                  (t) => {
                    const locked = t !== 'SALARY' && !canConsult
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={field.state.value === t}
                        disabled={locked}
                        onClick={() => field.handleChange(t)}
                        className={cn(
                          'flex-1 px-3 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          field.state.value === t
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted',
                        )}
                      >
                        {PLAN_TYPE_LABEL[t]}
                      </button>
                    )
                  },
                )}
              </div>
            </FieldWrapper>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.type}>
          {(type) => (
            <>
              {type !== 'COMMISSION' && (
                <form.Field name="salary">
                  {(field) => (
                    <FieldWrapper
                      label="Monthly salary (Rs)"
                      htmlFor="comp-salary"
                      required
                      error={fieldError(field)}
                    >
                      <NumberInput
                        id="comp-salary"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              )}
              {type !== 'SALARY' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name="rate">
                      {(field) => (
                        <FieldWrapper
                          label="Default commission (%)"
                          htmlFor="comp-rate"
                          required
                          error={fieldError(field)}
                        >
                          <NumberInput
                            id="comp-rate"
                            placeholder="e.g. 40"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                        </FieldWrapper>
                      )}
                    </form.Field>
                    <form.Field name="basis">
                      {(field) => (
                        <FieldWrapper label="Commission on">
                          <div
                            className="flex overflow-hidden rounded-lg border border-border text-sm"
                            role="radiogroup"
                            aria-label="Commission basis"
                          >
                            {(['NET', 'GROSS'] as const).map((b) => (
                              <button
                                key={b}
                                type="button"
                                role="radio"
                                aria-checked={field.state.value === b}
                                onClick={() => field.handleChange(b)}
                                className={cn(
                                  'flex-1 px-3 py-2 transition-colors',
                                  field.state.value === b
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted',
                                )}
                              >
                                {b === 'NET'
                                  ? 'After discount'
                                  : 'Before discount'}
                              </button>
                            ))}
                          </div>
                        </FieldWrapper>
                      )}
                    </form.Field>
                  </div>
                  <form.Field name="rules">
                    {(field) => (
                      <FieldWrapper
                        label="Service-wise overrides"
                        hint="A service rule beats a category rule, which beats the default."
                      >
                        <CommissionRulesEditor
                          value={field.state.value}
                          onChange={(rows) => field.handleChange(rows)}
                          showErrors={
                            field.form.state.submissionAttempts > 0 ||
                            field.state.meta.isTouched
                          }
                        />
                      </FieldWrapper>
                    )}
                  </form.Field>
                </>
              )}
            </>
          )}
        </form.Subscribe>

        <form.Field name="effectiveFrom">
          {(field) => (
            <FieldWrapper
              label="Effective from"
              required
              error={fieldError(field)}
              hint={
                current
                  ? `The current version ends the day before. Must be after ${current.effectiveFrom}, or the same day to correct it.`
                  : undefined
              }
            >
              <DatePicker
                value={field.state.value}
                onChange={(v) => field.handleChange(v)}
                min={current?.effectiveFrom}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>
    </FormSheet>
  )
}

/** Edit only the overrides of the current version (later charges use them). */
export function CommissionRulesSheet({
  plan,
  open,
  onOpenChange,
}: {
  plan: CompensationPlan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useReplaceCommissionRules()
  const form = useForm({
    defaultValues: { rules: rowsFromPlan(plan) } as RulesOnlyValues,
    validators: { onChange: rulesOnlySchema, onSubmit: rulesOnlySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        planId: plan.id,
        rules: toRuleInputs(value.rules),
      })
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset({ rules: rowsFromPlan(plan) })
  }, [open, plan.id])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Commission overrides"
      description="Applies to charges created from now on; existing charges keep their rate."
      footer={
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
        >
          {([canSubmit, isSubmitting, isDirty]) => (
            <>
              <UnsavedNote dirty={isDirty} />
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save overrides
              </Button>
            </>
          )}
        </form.Subscribe>
      }
    >
      <form.Field name="rules">
        {(field) => (
          <CommissionRulesEditor
            value={field.state.value}
            onChange={(rows) => field.handleChange(rows)}
            showErrors={
              field.form.state.submissionAttempts > 0 ||
              field.state.meta.isTouched
            }
          />
        )}
      </form.Field>
    </FormSheet>
  )
}
