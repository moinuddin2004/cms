import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { FormSelect } from '@/components/forms/FormSelect'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
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

/** Create / edit one treatment plan template. */
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
  const form = usePlanTemplateForm({ template, onSubmit })

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
                placeholder="e.g. Root Canal Treatment (RCT)"
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
            <Label>Procedures, in order</Label>
            {items.state.value.map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md border border-border p-2 sm:grid-cols-[auto_1fr_72px_110px_auto]"
              >
                <span className="pt-2 text-xs font-mono text-muted-foreground">
                  {i + 1}.
                </span>
                <form.Field name={`items[${i}].procedureName`}>
                  {(f) => (
                    <div className="space-y-1">
                      <Input
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                        placeholder="Procedure"
                        aria-label={`Procedure ${i + 1}`}
                        aria-invalid={!!fieldError(f)}
                      />
                      {fieldError(f) && (
                        <p className="text-xs text-destructive">
                          {fieldError(f)}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
                <div className="col-span-3 grid grid-cols-2 gap-2 sm:contents">
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
                        />
                        {fieldError(f) && (
                          <p className="text-xs text-destructive">
                            {fieldError(f)}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name={`items[${i}].estimatedCost`}>
                    {(f) => (
                      <div className="space-y-1">
                        <NumberInput
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                          placeholder="Fee (Rs.)"
                          aria-label="Fee"
                          aria-invalid={!!fieldError(f)}
                        />
                        {fieldError(f) && (
                          <p className="text-xs text-destructive">
                            {fieldError(f)}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                </div>
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
                    tooltip="Remove procedure"
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
              <Plus className="size-3.5" /> Add procedure
            </Button>
            <p className="text-xs text-muted-foreground">
              Fees are optional. Set them here once and every plan started from
              this template carries them.
            </p>
          </div>
        )}
      </form.Field>

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
 * The list-level error ("Add at least one procedure"). The list has no input
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
