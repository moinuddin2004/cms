import { useForm } from '@tanstack/react-form'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { FormSelect } from '@/components/forms/FormSelect'
import { PLAN_TEMPLATE_CATEGORY_OPTIONS, PlanTemplateCategory } from '../types'
import type { PlanTemplate, PlanTemplateInput } from '../types'

interface ItemValues {
  procedureName: string
  estimatedSessions: number
  /** '' = not set. */
  estimatedCost: string
}

const emptyItem = (): ItemValues => ({
  procedureName: '',
  estimatedSessions: 1,
  estimatedCost: '',
})

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
  const form = useForm({
    defaultValues: {
      name: template?.name ?? '',
      category: template?.category ?? PlanTemplateCategory.GENERAL,
      description: template?.description ?? '',
      items: template?.items.length
        ? template.items.map(
            (i): ItemValues => ({
              procedureName: i.procedureName,
              estimatedSessions: i.estimatedSessions,
              estimatedCost:
                i.estimatedCost == null ? '' : String(i.estimatedCost),
            }),
          )
        : [emptyItem()],
    },
    onSubmit: ({ value }) => {
      onSubmit({
        name: value.name.trim(),
        category: value.category,
        description: value.description.trim() || null,
        items: value.items
          .filter((i) => i.procedureName.trim())
          .map((i) => ({
            procedureName: i.procedureName.trim(),
            estimatedSessions: Math.max(
              1,
              Math.round(i.estimatedSessions) || 1,
            ),
            estimatedCost:
              i.estimatedCost.trim() === '' ? null : Number(i.estimatedCost),
            notes: null,
          })),
      })
    },
  })

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
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              value.trim() ? undefined : 'Name is required',
          }}
        >
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
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive">
                  {field.state.meta.errors[0]}
                </p>
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
              className="h-16 resize-none"
              placeholder="What this plan covers"
            />
          </div>
        )}
      </form.Field>

      <form.Field
        name="items"
        mode="array"
        validators={{
          onChange: ({ value }) =>
            value.some((i) => i.procedureName.trim())
              ? undefined
              : 'Add at least one procedure',
        }}
      >
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
                    <Input
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      placeholder="Procedure"
                      aria-label={`Procedure ${i + 1}`}
                    />
                  )}
                </form.Field>
                <div className="col-span-3 grid grid-cols-2 gap-2 sm:contents">
                  <form.Field name={`items[${i}].estimatedSessions`}>
                    {(f) => (
                      <Input
                        type="number"
                        min={1}
                        value={f.state.value}
                        onChange={(e) =>
                          f.handleChange(Number(e.target.value) || 1)
                        }
                        aria-label="Sessions"
                        title="Sessions (visits)"
                      />
                    )}
                  </form.Field>
                  <form.Field name={`items[${i}].estimatedCost`}>
                    {(f) => (
                      <Input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        placeholder="Fee (Rs.)"
                        aria-label="Fee"
                      />
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
            {items.state.meta.errors[0] && (
              <p className="text-xs text-destructive">
                {items.state.meta.errors[0]}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void items.pushValue(emptyItem())}
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
